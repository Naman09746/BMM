from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request, Depends
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import secrets
import bcrypt
import jwt
import uuid
import re
import ipaddress
import json
import httpx
import requests
import hmac
import hashlib
import base64
import struct
import time
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'bdsm_database')]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Owner access only.")
    return user


# Forwarded client addresses are trusted only when the immediate connection is
# from an explicitly configured reverse proxy. Leave empty when unsure.
TRUSTED_PROXY_NETWORKS = tuple(
    ipaddress.ip_network(value.strip(), strict=False)
    for value in os.getenv("TRUSTED_PROXY_CIDRS", "").split(",") if value.strip()
)


def _is_trusted_proxy(address: ipaddress._BaseAddress) -> bool:
    return any(address in network for network in TRUSTED_PROXY_NETWORKS)


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return "unknown"
    if not _is_trusted_proxy(peer_ip):
        return str(peer_ip)

    # Walk from the trusted proxy toward the client. The first untrusted hop is
    # the client address; forged values to its left are ignored.
    forwarded = request.headers.get("x-forwarded-for", "").split(",")
    for value in reversed(forwarded):
        try:
            candidate = ipaddress.ip_address(value.strip())
        except ValueError:
            continue
        if not _is_trusted_proxy(candidate):
            return str(candidate)
    return str(peer_ip)


def rate_limit(bucket: str, max_requests: int = 5, window_seconds: int = 3600):
    """Atomically enforce a shared Mongo-backed fixed-window IP limit."""
    async def _dep(request: Request):
        ip = _client_ip(request)
        now = datetime.now(timezone.utc)
        window = int(now.timestamp()) // window_seconds
        key = f"{bucket}:{ip}:{window}"
        try:
            count = await db.rate_limits.find_one_and_update(
                {"_id": key},
                {"$inc": {"count": 1}, "$setOnInsert": {
                    "expires_at": now + timedelta(seconds=window_seconds * 2),
                    "bucket": bucket,
                }},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            # Two first requests can race the upsert; retry against the now
            # existing unique bucket document.
            count = await db.rate_limits.find_one_and_update(
                {"_id": key}, {"$inc": {"count": 1}}, return_document=ReturnDocument.AFTER
            )
        if count["count"] > max_requests:
            raise HTTPException(status_code=429, detail="Too many submissions. Please try again later.")
    return _dep


async def _with_booking_lock(stay: str, owner: str):
    """Atomically claim a lease for one listing; return its lock ID or raise 503."""
    lock_id = f"booking:{stay.casefold().strip()}"
    try:
        await db.booking_locks.insert_one({"_id": lock_id})
    except DuplicateKeyError:
        pass
    now = datetime.now(timezone.utc)
    lease_until = (now + timedelta(minutes=2)).isoformat()
    lock = await db.booking_locks.find_one_and_update(
        {"_id": lock_id, "$or": [{"lease_until": {"$exists": False}}, {"lease_until": {"$lt": now.isoformat()}}]},
        {"$set": {"lease_until": lease_until, "owner": owner}},
        return_document=ReturnDocument.AFTER,
    )
    if not lock:
        raise HTTPException(status_code=503, detail="Booking is being processed. Please try again shortly.")
    return lock_id


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


# --- Email notifications (Emergent managed Resend / Direct Resend) ---

EMAIL_BASE_URL = os.environ.get("EMAIL_BASE_URL", "https://integrations.emergentagent.com")
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", os.environ.get("RESEND_API_KEY", ""))
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "BDS Marvel")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "info@bdsmarvel.com")

# Razorpay payments configuration (optional)
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY or EMAIL_KEY in ("replace-with-provider-key", "placeholder"):
        logger.info("Email dispatch skipped (no valid EMAIL_KEY configured): to=%s, subject=%s", to, subject)
        return "skipped-no-key"

    payload = {"to": [to], "subject": subject, "html": html,
               "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO

    try:
        if EMAIL_KEY.startswith("re_"):
            # Direct Resend API
            async with httpx.AsyncClient(timeout=30) as client:
                resend_payload = {
                    "from": f"{EMAIL_FROM_NAME} <onboarding@resend.dev>" if "resend.dev" in OWNER_EMAIL else f"{EMAIL_FROM_NAME} <{EMAIL_REPLY_TO or OWNER_EMAIL}>",
                    "to": [to],
                    "subject": subject,
                    "html": html,
                }
                if reply_to or EMAIL_REPLY_TO:
                    resend_payload["reply_to"] = reply_to or EMAIL_REPLY_TO
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {EMAIL_KEY}", "Content-Type": "application/json"},
                    json=resend_payload,
                )
            resp.raise_for_status()
            return resp.json().get("id")

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


def _inquiry_email_html(inq: "Inquiry") -> str:
    def row(label, value):
        return (f'<tr><td style="padding:8px 16px 8px 0;color:#8a8577;font-size:11px;'
                f'letter-spacing:2px;text-transform:uppercase;vertical-align:top">{label}</td>'
                f'<td style="padding:8px 0;font-size:14px;color:#141414">{value}</td></tr>')
    rows = row("Name", escape(inq.name))
    rows += row("Email", f'<a href="mailto:{escape(inq.email)}" style="color:#141414">{escape(inq.email)}</a>')
    if inq.company:
        rows += row("Company", escape(inq.company))
    if inq.agency:
        rows += row("Business", escape(inq.agency))
    if inq.budget:
        rows += row("Budget", escape(inq.budget))
    rows += row("Message", escape(inq.message).replace("\n", "<br />"))
    return ('<table role="presentation" width="100%" style="background:#f5f2ea;padding:32px 0">'
            '<tr><td align="center"><table role="presentation" width="560" '
            'style="background:#ffffff;padding:32px;font-family:Arial,sans-serif">'
            '<tr><td><p style="font-size:11px;letter-spacing:3px;color:#8a8577;margin:0 0 8px">BDS MARVEL &middot; NEW INQUIRY</p>'
            '<h1 style="font-size:22px;margin:0 0 24px;color:#141414">New project inquiry</h1>'
            f'<table role="presentation" width="100%">{rows}</table>'
            f'<p style="font-size:12px;color:#8a8577;margin:24px 0 0">Sent by the {escape(EMAIL_FROM_NAME)} website contact form. We never ask for passwords or card details by email.</p>'
            '</td></tr></table></td></tr></table>')


# --- Inquiries (Contact form) ---

class InquiryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(default=None, max_length=160)
    agency: Optional[str] = Field(default=None, max_length=80)
    budget: Optional[str] = Field(default=None, max_length=60)
    message: str = Field(min_length=5, max_length=4000)


class Inquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    company: Optional[str] = None
    agency: Optional[str] = None
    budget: Optional[str] = None
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@api_router.post("/inquiries", response_model=Inquiry, status_code=201)
async def create_inquiry(payload: InquiryCreate, _rl=Depends(rate_limit("inquiries"))):
    inquiry = Inquiry(**payload.model_dump())
    doc = inquiry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.inquiries.insert_one(doc)
    logger.info("New inquiry from %s <%s>", inquiry.name, inquiry.email)
    try:
        await send_email(to=OWNER_EMAIL, subject=f"New project inquiry - {inquiry.name}",
                         html=_inquiry_email_html(inquiry))
        logger.info("Inquiry notification emailed to %s", OWNER_EMAIL)
    except Exception as exc:
        logger.error("Inquiry saved but email notification failed: %s", exc)
    return inquiry


@api_router.get("/inquiries", response_model=List[Inquiry])
async def list_inquiries(limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    rows = await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for row in rows:
        if isinstance(row.get('created_at'), str):
            row['created_at'] = datetime.fromisoformat(row['created_at'])
    return rows


# --- Stay bookings (Air BnB booking requests) ---

class BookingCreate(BaseModel):
    stay: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    check_in: str
    check_out: str
    guests: int = Field(ge=1, le=16)
    message: Optional[str] = Field(default=None, max_length=1000)


class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stay: str
    name: str
    email: str
    check_in: str
    check_out: str
    guests: int
    message: Optional[str] = None
    status: str = "requested"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _booking_email_html(bk: "Booking") -> str:
    def row(label, value):
        return (f'<tr><td style="padding:8px 16px 8px 0;color:#8a8577;font-size:11px;'
                f'letter-spacing:2px;text-transform:uppercase;vertical-align:top">{label}</td>'
                f'<td style="padding:8px 0;font-size:14px;color:#141414">{value}</td></tr>')
    rows = row("Stay", escape(bk.stay))
    rows += row("Dates", f'{escape(bk.check_in)} &rarr; {escape(bk.check_out)}')
    rows += row("Guests", str(bk.guests))
    rows += row("Name", escape(bk.name))
    rows += row("Email", f'<a href="mailto:{escape(bk.email)}" style="color:#141414">{escape(bk.email)}</a>')
    if bk.message:
        rows += row("Notes", escape(bk.message).replace("\n", "<br />"))
    return ('<table role="presentation" width="100%" style="background:#f5f2ea;padding:32px 0">'
            '<tr><td align="center"><table role="presentation" width="560" '
            'style="background:#ffffff;padding:32px;font-family:Arial,sans-serif">'
            '<tr><td><p style="font-size:11px;letter-spacing:3px;color:#8a8577;margin:0 0 8px">BDS MARVEL &middot; STAY BOOKING</p>'
            '<h1 style="font-size:22px;margin:0 0 24px;color:#141414">New booking request</h1>'
            f'<table role="presentation" width="100%">{rows}</table>'
            f'<p style="font-size:12px;color:#8a8577;margin:24px 0 0">Sent by the {escape(EMAIL_FROM_NAME)} website stays page. We never ask for passwords or card details by email.</p>'
            '</td></tr></table></td></tr></table>')


@api_router.post("/bookings", response_model=Booking, status_code=201)
async def create_booking(payload: BookingCreate, _rl=Depends(rate_limit("bookings"))):
    try:
        check_in = datetime.strptime(payload.check_in, "%Y-%m-%d").date()
        check_out = datetime.strptime(payload.check_out, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if check_out <= check_in:
        raise HTTPException(status_code=422, detail="Check-out must be after check-in")
    existing = await db.bookings.find({"stay": payload.stay, "status": "confirmed"}, {"_id": 0, "check_in": 1, "check_out": 1}).to_list(500)
    for other in existing:
        if payload.check_in < other["check_out"] and payload.check_out > other["check_in"]:
            raise HTTPException(status_code=409, detail=f"Those nights are already booked ({other['check_in']} to {other['check_out']}). Please pick different dates.")
    booking = Booking(**payload.model_dump())
    doc = booking.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.bookings.insert_one(doc)
    logger.info("New booking request for %s from %s <%s>", booking.stay, booking.name, booking.email)
    try:
        await send_email(to=OWNER_EMAIL, subject=f"New stay booking - {booking.stay}",
                         html=_booking_email_html(booking))
        logger.info("Booking notification emailed to %s", OWNER_EMAIL)
    except Exception as exc:
        logger.error("Booking saved but email notification failed: %s", exc)
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings(limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    rows = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for row in rows:
        if isinstance(row.get('created_at'), str):
            row['created_at'] = datetime.fromisoformat(row['created_at'])
    return rows


@api_router.get("/stays/availability")
async def stays_availability(stay: Optional[str] = None):
    query = {"stay": stay} if stay else {}
    projection = {"_id": 0, "stay": 1, "check_in": 1, "check_out": 1}
    confirmed = await db.bookings.find({**query, "status": "confirmed"}, projection).to_list(1000)
    requested = await db.bookings.find({**query, "status": "requested"}, projection).to_list(1000)
    return {"booked": confirmed, "requested": requested}


class BookingStatusUpdate(BaseModel):
    status: str


@api_router.post("/bookings/{booking_id}/status", response_model=Booking)
async def update_booking_status(booking_id: str, payload: BookingStatusUpdate, _: dict = Depends(require_admin)):
    if payload.status not in ("requested", "confirmed", "cancelled"):
        raise HTTPException(status_code=422, detail="Status must be requested, confirmed or cancelled")
    target = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Booking not found")
    if payload.status == "confirmed":
        lock_owner = f"admin:{uuid.uuid4()}"
        stay_slug = target.get("stay_slug")
        if not stay_slug:
            try:
                catalogue = json.loads((ROOT_DIR / "stays.json").read_text())
                stay_slug = next((item["slug"] for item in catalogue if item.get("name") == target["stay"]), target["stay"])
            except (OSError, json.JSONDecodeError):
                stay_slug = target["stay"]
        lock_id = await _with_booking_lock(stay_slug, lock_owner)
        try:
            clash = await _confirmed_overlap(target["stay"], target["check_in"], target["check_out"], exclude_id=booking_id)
            if clash:
                raise HTTPException(status_code=409, detail=f"Those nights are already confirmed for another guest ({clash['check_in']} to {clash['check_out']}).")
            result = await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "confirmed"}})
        finally:
            await db.booking_locks.delete_one({"_id": lock_id, "owner": lock_owner})
    else:
        result = await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if isinstance(doc.get('created_at'), str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    logger.info("Booking %s marked %s", booking_id, payload.status)
    return doc


# --- Object storage (Emergent) for optional consultation file uploads ---

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "bdsmarvel"
_storage_key = None

_MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "heic": "image/heic", "pdf": "application/pdf",
}


_MAGIC = {"jpg": [b"\xff\xd8\xff"], "jpeg": [b"\xff\xd8\xff"], "png": [b"\x89PNG"], "gif": [b"GIF8"], "pdf": [b"%PDF"]}


def _magic_ok(ext: str, data: bytes) -> bool:
    if ext == "webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if ext == "heic":
        return data[4:8] == b"ftyp"
    return any(data.startswith(m) for m in _MAGIC[ext])


UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.warning("Could not initialize external storage proxy (%s); using local filesystem.", e)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        local_path = UPLOAD_DIR / Path(path).name
        local_path.write_bytes(data)
        return {"path": f"uploads/{local_path.name}", "size": len(data)}
    try:
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code == 404:
            key = init_storage(force=True)
            if not key:
                local_path = UPLOAD_DIR / Path(path).name
                local_path.write_bytes(data)
                return {"path": f"uploads/{local_path.name}", "size": len(data)}
            resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                                headers={"X-Storage-Key": key, "Content-Type": content_type},
                                data=data, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("Remote put_object failed (%s); writing to local disk fallback.", exc)
        local_path = UPLOAD_DIR / Path(path).name
        local_path.write_bytes(data)
        return {"path": f"uploads/{local_path.name}", "size": len(data)}


def get_object(path: str):
    local_path = (ROOT_DIR / path).resolve()
    try:
        local_path.relative_to(ROOT_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    if local_path.exists() and local_path.is_file():
        ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        return local_path.read_bytes(), _MIME_TYPES.get(ext, "application/octet-stream")
    key = init_storage()
    if not key:
        raise HTTPException(status_code=404, detail="File not found")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")



@api_router.post("/consultations/upload")
async def upload_consultation_file(file: UploadFile = File(...), _rl=Depends(rate_limit("uploads", max_requests=10))):
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 15MB)")
    filename = (file.filename or "upload")[-200:]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _MIME_TYPES or not _magic_ok(ext, data):
        raise HTTPException(status_code=415, detail="Only JPG, PNG, GIF, WEBP, HEIC or PDF files are allowed")
    content_type = _MIME_TYPES[ext]
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/consultations/{file_id}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as exc:
        logger.error("Consultation file upload failed: %s", exc)
        raise HTTPException(status_code=502, detail="File upload failed, please try again")
    await db.consultation_files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": file_id, "filename": filename, "url": f"/api/files/{file_id}"}


@api_router.get("/files/{file_id}")
async def download_file(file_id: str, _: dict = Depends(require_admin)):
    record = await db.consultation_files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, _ct = get_object(record["storage_path"])
    ext = record["storage_path"].rsplit(".", 1)[-1].lower()
    return Response(content=data, media_type=_MIME_TYPES.get(ext, "application/octet-stream"), headers={
        "Content-Disposition": f'attachment; filename="{file_id}.{ext}"', "X-Content-Type-Options": "nosniff"})


# --- Consultation inquiries (per-service consulting requests) ---

class ConsultationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=3, max_length=40)
    email: EmailStr
    city: Optional[str] = Field(default=None, max_length=120)
    project_type: Optional[str] = Field(default=None, max_length=120)
    service: str = Field(min_length=1, max_length=120)
    requirements: str = Field(min_length=3, max_length=4000)
    project_size: Optional[str] = Field(default=None, max_length=120)
    budget: Optional[str] = Field(default=None, max_length=60)
    file_id: Optional[str] = Field(default=None, max_length=60)
    file_name: Optional[str] = Field(default=None, max_length=260)


class Consultation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: str
    city: Optional[str] = None
    project_type: Optional[str] = None
    service: str
    requirements: str
    project_size: Optional[str] = None
    budget: Optional[str] = None
    file_id: Optional[str] = None
    file_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _consultation_email_html(c: "Consultation") -> str:
    def row(label, value):
        return (f'<tr><td style="padding:8px 16px 8px 0;color:#8a8577;font-size:11px;'
                f'letter-spacing:2px;text-transform:uppercase;vertical-align:top">{label}</td>'
                f'<td style="padding:8px 0;font-size:14px;color:#141414">{value}</td></tr>')
    rows = row("Service", escape(c.service))
    rows += row("Name", escape(c.name))
    rows += row("Phone", escape(c.phone))
    rows += row("Email", f'<a href="mailto:{escape(c.email)}" style="color:#141414">{escape(c.email)}</a>')
    if c.city:
        rows += row("City", escape(c.city))
    if c.project_type:
        rows += row("Project type", escape(c.project_type))
    if c.project_size:
        rows += row("Project size", escape(c.project_size))
    if c.budget:
        rows += row("Budget", escape(c.budget))
    rows += row("Requirements", escape(c.requirements).replace("\n", "<br />"))
    if c.file_name:
        rows += row("Attachment", escape(c.file_name))
    return ('<table role="presentation" width="100%" style="background:#f5f2ea;padding:32px 0">'
            '<tr><td align="center"><table role="presentation" width="560" '
            'style="background:#ffffff;padding:32px;font-family:Arial,sans-serif">'
            '<tr><td><p style="font-size:11px;letter-spacing:3px;color:#8a8577;margin:0 0 8px">BDS MARVEL &middot; CONSULTATION</p>'
            '<h1 style="font-size:22px;margin:0 0 24px;color:#141414">New consultation request</h1>'
            f'<table role="presentation" width="100%">{rows}</table>'
            f'<p style="font-size:12px;color:#8a8577;margin:24px 0 0">Sent by the {escape(EMAIL_FROM_NAME)} website consultation form. We never ask for passwords or card details by email.</p>'
            '</td></tr></table></td></tr></table>')


@api_router.post("/consultations", response_model=Consultation, status_code=201)
async def create_consultation(payload: ConsultationCreate, _rl=Depends(rate_limit("consultations"))):
    consultation = Consultation(**payload.model_dump())
    doc = consultation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.consultations.insert_one(doc)
    logger.info("New consultation (%s) from %s <%s>", consultation.service, consultation.name, consultation.email)
    try:
        await send_email(to=OWNER_EMAIL, subject=f"New consultation - {consultation.service}",
                         html=_consultation_email_html(consultation))
        logger.info("Consultation notification emailed to %s", OWNER_EMAIL)
    except Exception as exc:
        logger.error("Consultation saved but email notification failed: %s", exc)
    return consultation


@api_router.get("/consultations", response_model=List[Consultation])
async def list_consultations(limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    rows = await db.consultations.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for row in rows:
        if isinstance(row.get('created_at'), str):
            row['created_at'] = datetime.fromisoformat(row['created_at'])
    return rows



# --- Shared email helpers ---

def _email_row(label, value):
    return (f'<tr><td style="padding:8px 16px 8px 0;color:#8a8577;font-size:11px;'
            f'letter-spacing:2px;text-transform:uppercase;vertical-align:top">{label}</td>'
            f'<td style="padding:8px 0;font-size:14px;color:#141414">{value}</td></tr>')


def _email_shell(kicker: str, title: str, rows: str, source: str) -> str:
    return ('<table role="presentation" width="100%" style="background:#f5f2ea;padding:32px 0">'
            '<tr><td align="center"><table role="presentation" width="560" '
            'style="background:#ffffff;padding:32px;font-family:Arial,sans-serif">'
            f'<tr><td><p style="font-size:11px;letter-spacing:3px;color:#8a8577;margin:0 0 8px">BDS MARVEL &middot; {kicker}</p>'
            f'<h1 style="font-size:22px;margin:0 0 24px;color:#141414">{title}</h1>'
            f'<table role="presentation" width="100%">{rows}</table>'
            f'<p style="font-size:12px;color:#8a8577;margin:24px 0 0">Sent by the {escape(EMAIL_FROM_NAME)} website {source}. We never ask for passwords or card details by email.</p>'
            '</td></tr></table></td></tr></table>')


# --- Sample requests (catalogue "Request Sample" form) ---

class SampleRequestCreate(BaseModel):
    product: str = Field(min_length=1, max_length=160)
    brand: Optional[str] = Field(default=None, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=3, max_length=40)
    address: str = Field(min_length=5, max_length=500)
    city: Optional[str] = Field(default=None, max_length=120)
    pincode: Optional[str] = Field(default=None, max_length=12)
    notes: Optional[str] = Field(default=None, max_length=1000)


class SampleRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product: str
    brand: Optional[str] = None
    name: str
    email: str
    phone: str
    address: str
    city: Optional[str] = None
    pincode: Optional[str] = None
    notes: Optional[str] = None
    status: str = "requested"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _sample_request_email_html(sr: "SampleRequest") -> str:
    rows = _email_row("Product", escape(sr.product))
    if sr.brand:
        rows += _email_row("Brand", escape(sr.brand))
    rows += _email_row("Name", escape(sr.name))
    rows += _email_row("Phone", escape(sr.phone))
    rows += _email_row("Email", f'<a href="mailto:{escape(sr.email)}" style="color:#141414">{escape(sr.email)}</a>')
    rows += _email_row("Ship to", escape(sr.address).replace("\n", "<br />"))
    if sr.city:
        rows += _email_row("City", escape(sr.city))
    if sr.pincode:
        rows += _email_row("Pincode", escape(sr.pincode))
    if sr.notes:
        rows += _email_row("Notes", escape(sr.notes).replace("\n", "<br />"))
    return _email_shell("SAMPLE REQUEST", "New sample request", rows, "sample request form")


@api_router.post("/sample-requests", response_model=SampleRequest, status_code=201)
async def create_sample_request(payload: SampleRequestCreate, _rl=Depends(rate_limit("sample-requests"))):
    sample = SampleRequest(**payload.model_dump())
    doc = sample.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sample_requests.insert_one(doc)
    logger.info("New sample request (%s) from %s <%s>", sample.product, sample.name, sample.email)
    try:
        await send_email(to=OWNER_EMAIL, subject=f"New sample request - {sample.product}",
                         html=_sample_request_email_html(sample))
        logger.info("Sample request notification emailed to %s", OWNER_EMAIL)
    except Exception as exc:
        logger.error("Sample request saved but email notification failed: %s", exc)
    return sample


@api_router.get("/sample-requests", response_model=List[SampleRequest])
async def list_sample_requests(limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    rows = await db.sample_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for row in rows:
        if isinstance(row.get('created_at'), str):
            row['created_at'] = datetime.fromisoformat(row['created_at'])
    return rows


# --- Product quote requests (product page "Request Quote" form) ---

class QuoteRequestCreate(BaseModel):
    product: str = Field(min_length=1, max_length=200)
    collection: str = Field(min_length=1, max_length=160)
    brand: Optional[str] = Field(default=None, max_length=120)
    material: Optional[str] = Field(default=None, max_length=160)
    finish: Optional[str] = Field(default=None, max_length=160)
    use: Optional[str] = Field(default=None, max_length=160)
    product_url: Optional[str] = Field(default=None, max_length=500)
    image: Optional[str] = Field(default=None, max_length=500)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=3, max_length=40)
    city: Optional[str] = Field(default=None, max_length=120)
    quantity: Optional[str] = Field(default=None, max_length=120)
    timeline: Optional[str] = Field(default=None, max_length=60)
    want_sample: bool = False
    message: Optional[str] = Field(default=None, max_length=2000)


class QuoteRequest(QuoteRequestCreate):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    status: str = "new"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _quote_request_email_html(q: "QuoteRequest") -> str:
    rows = _email_row("Product", escape(q.product))
    rows += _email_row("Collection", escape(q.collection))
    for label, value in (("Brand", q.brand), ("Material", q.material), ("Finish", q.finish), ("Best for", q.use)):
        if value:
            rows += _email_row(label, escape(value))
    if q.product_url:
        rows += _email_row("Product page", f'<a href="{escape(q.product_url)}" style="color:#141414">{escape(q.product_url)}</a>')
    rows += _email_row("Name", escape(q.name))
    rows += _email_row("Phone", escape(q.phone))
    rows += _email_row("Email", f'<a href="mailto:{escape(q.email)}" style="color:#141414">{escape(q.email)}</a>')
    for label, value in (("City", q.city), ("Quantity / area", q.quantity), ("Timeline", q.timeline)):
        if value:
            rows += _email_row(label, escape(value))
    rows += _email_row("Sample wanted", "Yes" if q.want_sample else "No")
    if q.message:
        rows += _email_row("Message", escape(q.message).replace("\n", "<br />"))
    return _email_shell("QUOTE REQUEST", "New product quote request", rows, "product quote form")


def _safe_https(url: Optional[str]) -> Optional[str]:
    return url if url and urlparse(url).scheme == "https" else None


def _quote_customer_email_html(q: "QuoteRequest") -> str:
    image = _safe_https(q.image)
    rows = _email_row("", f'<img src="{escape(image)}" alt="{escape(q.product)}" width="240" style="display:block;border-radius:8px;max-width:100%" />') if image else ""
    rows += _email_row("Product", escape(q.product))
    rows += _email_row("Collection", escape(q.collection))
    for label, value in (("Brand", q.brand), ("Material", q.material), ("Finish", q.finish), ("Best for", q.use),
                         ("Quantity / area", q.quantity), ("Needed by", q.timeline)):
        if value:
            rows += _email_row(label, escape(value))
    rows += _email_row("Sample", "Requested" if q.want_sample else "Not requested")
    link = _safe_https(q.product_url)
    if link:
        rows += _email_row("Product page", f'<a href="{escape(link)}" style="color:#141414">View this product</a>')
    rows += _email_row("What's next", "Our team will reply with pricing and lead times within one working day.")
    return _email_shell("QUOTE REQUEST", f"We've received your quote request, {escape(q.name.split()[0])}", rows, "product quote form")


@api_router.post("/quote-requests", response_model=QuoteRequest, status_code=201)
async def create_quote_request(payload: QuoteRequestCreate, _rl=Depends(rate_limit("quote-requests"))):
    quote = QuoteRequest(**payload.model_dump())
    doc = quote.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.quote_requests.insert_one(doc)
    logger.info("New quote request (%s) from %s <%s>", quote.product, quote.name, quote.email)
    try:
        await send_email(to=OWNER_EMAIL, subject=f"New quote request - {quote.product}", html=_quote_request_email_html(quote))
    except Exception as exc:
        logger.error("Quote request saved but email notification failed: %s", exc)
    try:
        await send_email(to=quote.email, subject=f"Your quote request - {quote.product}", html=_quote_customer_email_html(quote))
        logger.info("Quote confirmation emailed to %s", quote.email)
    except Exception as exc:
        logger.error("Quote request saved but customer confirmation failed: %s", exc)
    return quote


@api_router.get("/quote-requests", response_model=List[QuoteRequest])
async def list_quote_requests(limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    rows = await db.quote_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for row in rows:
        if isinstance(row.get('created_at'), str):
            row['created_at'] = datetime.fromisoformat(row['created_at'])
    return rows


# --- Product inquiries (brand-page "Make an Inquiry" form) ---

class ProductInquiryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=40)
    brand: str = Field(min_length=1, max_length=120)
    product: Optional[str] = Field(default=None, max_length=160)
    quantity: Optional[str] = Field(default=None, max_length=120)
    message: str = Field(min_length=5, max_length=4000)


class ProductInquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: Optional[str] = None
    brand: str
    product: Optional[str] = None
    quantity: Optional[str] = None
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _product_inquiry_email_html(pi: "ProductInquiry") -> str:
    rows = _email_row("Brand", escape(pi.brand))
    if pi.product:
        rows += _email_row("Product", escape(pi.product))
    if pi.quantity:
        rows += _email_row("Quantity", escape(pi.quantity))
    rows += _email_row("Name", escape(pi.name))
    rows += _email_row("Email", f'<a href="mailto:{escape(pi.email)}" style="color:#141414">{escape(pi.email)}</a>')
    if pi.phone:
        rows += _email_row("Phone", escape(pi.phone))
    rows += _email_row("Message", escape(pi.message).replace("\n", "<br />"))
    return _email_shell("PRODUCT INQUIRY", f"New {escape(pi.brand)} product inquiry", rows, "product inquiry form")


@api_router.post("/product-inquiries", response_model=ProductInquiry, status_code=201)
async def create_product_inquiry(payload: ProductInquiryCreate, _rl=Depends(rate_limit("product-inquiries"))):
    inquiry = ProductInquiry(**payload.model_dump())
    doc = inquiry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.product_inquiries.insert_one(doc)
    logger.info("New product inquiry (%s / %s) from %s <%s>", inquiry.brand, inquiry.product or "-", inquiry.name, inquiry.email)
    try:
        await send_email(to=OWNER_EMAIL, subject=f"New product inquiry - {inquiry.brand}",
                         html=_product_inquiry_email_html(inquiry))
        logger.info("Product inquiry notification emailed to %s", OWNER_EMAIL)
    except Exception as exc:
        logger.error("Product inquiry saved but email notification failed: %s", exc)
    return inquiry


@api_router.get("/product-inquiries", response_model=List[ProductInquiry])
async def list_product_inquiries(limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 200))
    rows = await db.product_inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for row in rows:
        if isinstance(row.get('created_at'), str):
            row['created_at'] = datetime.fromisoformat(row['created_at'])
    return rows


# --- Auth: JWT email/password + Emergent-managed Google sign-in (shared users collection) ---

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "bdsmarvel-insecure-dev-secret-change-in-production")
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _jwt(user_id: str, kind: str, delta: timedelta) -> str:
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _set_cookie(response: Response, key: str, value: str, max_age: int):
    response.set_cookie(key=key, value=value, httponly=True, secure=True, samesite="none", max_age=max_age, path="/")


def _issue_jwt(response: Response, user_id: str):
    _set_cookie(response, "access_token", _jwt(user_id, "access", timedelta(minutes=15)), 900)
    _set_cookie(response, "refresh_token", _jwt(user_id, "refresh", timedelta(days=7)), 604800)


def generate_totp(secret: str, time_step: int = 30, digits: int = 6, for_time: float = None) -> str:
    if for_time is None:
        for_time = time.time()
    counter = int(for_time // time_step)
    cleaned = secret.strip().replace(" ", "").upper()
    padding = (8 - len(cleaned) % 8) % 8
    key = base64.b32decode(cleaned + "=" * padding)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack(">I", digest[offset:offset+4])[0] & 0x7FFFFFFF
    return str(code_int % (10 ** digits)).zfill(digits)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    if not secret or not code:
        return False
    code = str(code).strip()
    if not re.fullmatch(r"\d{6}", code):
        return False
    now = time.time()
    for drift in range(-window, window + 1):
        if hmac.compare_digest(generate_totp(secret, for_time=now + drift * 30), code):
            return True
    return False


async def log_admin_action(admin: any, action: str, target: str, details: dict = None, request: Request = None):
    try:
        admin_dict = admin if isinstance(admin, dict) else {}
        ip = _client_ip(request) if request and hasattr(request, "headers") else "unknown"
        ua = (request.headers.get("user-agent", "")[:200]) if request and hasattr(request, "headers") else ""
        entry = {
            "id": f"aud_{uuid.uuid4().hex[:12]}",
            "admin_id": admin_dict.get("user_id", "admin"),
            "admin_email": admin_dict.get("email", "admin@bdsmarvel.com"),
            "action": action,
            "target": target,
            "details": details or {},
            "ip": ip,
            "user_agent": ua,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if hasattr(db, "audit_logs") and hasattr(db.audit_logs, "insert_one"):
            await db.audit_logs.insert_one(entry)
        logger.info("AUDIT: Admin %s performed %s on %s", admin_dict.get("email"), action, target)
    except Exception as e:
        logger.warning("Failed to record audit log: %s", e)


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "guest"
    mfa_required: Optional[bool] = None
    mfa_token: Optional[str] = None
    totp_enabled: Optional[bool] = None


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    totp_code: Optional[str] = None
    mfa_token: Optional[str] = None


class MfaVerifyIn(BaseModel):
    mfa_token: str
    totp_code: str = Field(min_length=6, max_length=6)


class MfaSetupIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class SessionIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=400)


async def _user_from_session(token: str):
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})


async def _user_from_jwt(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    return await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    bearer = auth_header[7:] if auth_header.startswith("Bearer ") else None
    for token, kind in ((request.cookies.get("session_token"), "session"), (request.cookies.get("access_token"), "jwt"), (bearer, "session"), (bearer, "jwt")):
        if not token:
            continue
        user = await (_user_from_session(token) if kind == "session" else _user_from_jwt(token))
        if user:
            return user
    raise HTTPException(status_code=401, detail="Not authenticated")


@api_router.post("/auth/register", response_model=UserOut)
async def register(payload: RegisterIn, response: Response, _rl=Depends(rate_limit("register"))):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please log in.")
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": payload.name.strip(),
            "password_hash": hash_password(payload.password), "role": "guest", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    _issue_jwt(response, user["user_id"])
    return UserOut(**user)


@api_router.post("/auth/login", response_model=UserOut)
async def login(payload: LoginIn, request: Request, response: Response, _rl=Depends(rate_limit("login", max_requests=30, window_seconds=900))):
    email = payload.email.lower()
    identifier = f"{_client_ip(request)}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    acct = await db.login_attempts.find_one({"identifier": f"acct:{email}"}, {"_id": 0})
    now = datetime.now(timezone.utc)
    for a in (attempt, acct):
        if a and a.get("locked_until"):
            locked_until = datetime.fromisoformat(a["locked_until"])
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > now:
                raise HTTPException(status_code=429, detail="Too many attempts. Please try again in 15 minutes.")
            # Expired locks start a fresh window instead of retaining stale counts.
            await db.login_attempts.delete_one({"identifier": a["identifier"]})
            if a is attempt:
                attempt = None
            else:
                acct = None
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        update = {"count": count, "locked_until": (now + timedelta(minutes=15)).isoformat() if count >= 5 else None,
                  "updated_at": now}
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        acct_count = (acct or {}).get("count", 0) + 1
        await db.login_attempts.update_one({"identifier": f"acct:{email}"}, {"$set": {
            "count": 0 if acct_count >= 20 else acct_count,
            "locked_until": (now + timedelta(minutes=15)).isoformat() if acct_count >= 20 else None,
            "updated_at": now}}, upsert=True)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if user.get("role") == "admin":
        totp_secret = user.get("totp_secret") or os.environ.get("ADMIN_TOTP_SECRET")
        totp_enabled = bool(user.get("totp_enabled") or os.environ.get("ADMIN_TOTP_SECRET"))
        if totp_enabled and totp_secret:
            if not payload.totp_code:
                mfa_token = _jwt(user["user_id"], "mfa_pending", timedelta(minutes=5))
                return UserOut(
                    user_id=user["user_id"],
                    email=user["email"],
                    name=user.get("name", "Admin"),
                    role="admin",
                    mfa_required=True,
                    mfa_token=mfa_token,
                    totp_enabled=True,
                )
            if not verify_totp(totp_secret, payload.totp_code):
                count = (attempt or {}).get("count", 0) + 1
                update = {"count": count, "locked_until": (now + timedelta(minutes=15)).isoformat() if count >= 5 else None,
                          "updated_at": now}
                await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
                raise HTTPException(status_code=401, detail="Invalid two-factor authentication code.")

    await db.login_attempts.delete_many({"identifier": {"$in": [identifier, f"acct:{email}"]}})
    _issue_jwt(response, user["user_id"])
    if user.get("role") == "admin":
        await log_admin_action(user, "admin_login", f"user:{user['user_id']}", request=request)
        await _alert_new_admin_device(request)
    return UserOut(**user)


@api_router.post("/auth/mfa-verify", response_model=UserOut)
async def verify_mfa(payload: MfaVerifyIn, request: Request, response: Response):
    try:
        decoded = jwt.decode(payload.mfa_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if decoded.get("type") != "mfa_pending":
            raise HTTPException(status_code=401, detail="Invalid MFA token.")
        user_id = decoded.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="MFA session expired. Please sign in again.")

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    email = user["email"].lower()
    identifier = f"{_client_ip(request)}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    acct = await db.login_attempts.find_one({"identifier": f"acct:{email}"}, {"_id": 0})
    now = datetime.now(timezone.utc)
    for a in (attempt, acct):
        if a and a.get("locked_until"):
            locked_until = datetime.fromisoformat(a["locked_until"])
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > now:
                raise HTTPException(status_code=429, detail="Too many attempts. Please try again in 15 minutes.")
            await db.login_attempts.delete_one({"identifier": a["identifier"]})
            if a is attempt:
                attempt = None
            else:
                acct = None

    totp_secret = user.get("totp_secret") or os.environ.get("ADMIN_TOTP_SECRET")
    if not totp_secret or not verify_totp(totp_secret, payload.totp_code):
        count = (attempt or {}).get("count", 0) + 1
        update = {"count": count, "locked_until": (now + timedelta(minutes=15)).isoformat() if count >= 5 else None,
                  "updated_at": now}
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid two-factor authentication code.")

    await db.login_attempts.delete_many({"identifier": {"$in": [identifier, f"acct:{email}"]}})
    _issue_jwt(response, user["user_id"])
    await log_admin_action(user, "admin_login_mfa_success", f"user:{user['user_id']}", request=request)
    if user.get("role") == "admin":
        await _alert_new_admin_device(request)
    return UserOut(**user)


_UA_LABELS = [("Edg", "Edge"), ("OPR", "Opera"), ("Chrome", "Chrome"), ("Firefox", "Firefox"), ("Safari", "Safari")]
_OS_LABELS = [("Windows", "Windows"), ("Mac OS", "macOS"), ("Android", "Android"), ("iPhone", "iOS"), ("iPad", "iPadOS"), ("Linux", "Linux")]


def _device_label(ua: str) -> str:
    browser = next((label for token, label in _UA_LABELS if token in ua), "Browser")
    os_name = next((label for token, label in _OS_LABELS if token in ua), "unknown OS")
    return f"{browser} on {os_name}"


def _new_device_email_html(ip: str, label: str, when: str) -> str:
    def row(k, v):
        return (f'<tr><td style="padding:8px 16px 8px 0;color:#8a8577;font-size:11px;letter-spacing:2px;'
                f'text-transform:uppercase;vertical-align:top">{k}</td><td style="padding:8px 0;font-size:14px;color:#141414">{v}</td></tr>')
    rows = row("Device", escape(label)) + row("IP address", escape(ip)) + row("Time", escape(when))
    return ('<table role="presentation" width="100%" style="background:#f5f2ea;padding:32px 0">'
            '<tr><td align="center"><table role="presentation" width="560" '
            'style="background:#ffffff;padding:32px;font-family:Arial,sans-serif">'
            '<tr><td><p style="font-size:11px;letter-spacing:3px;color:#8a8577;margin:0 0 8px">BDS MARVEL &middot; SECURITY ALERT</p>'
            '<h1 style="font-size:22px;margin:0 0 24px;color:#141414">Admin signed in from a new device</h1>'
            f'<table role="presentation" width="100%">{rows}</table>'
            '<p style="font-size:13px;color:#141414;margin:24px 0 0">If this was you, no action is needed. If not, sign in and change the admin password immediately.</p>'
            f'<p style="font-size:12px;color:#8a8577;margin:16px 0 0">Sent by the {escape(EMAIL_FROM_NAME)} website. We never ask for passwords by email.</p>'
            '</td></tr></table></td></tr></table>')


async def _alert_new_admin_device(request: Request):
    ip = _client_ip(request)
    ua = (request.headers.get("user-agent") or "")[:300]
    fingerprint = f"{ip}|{ua}"
    now = datetime.now(timezone.utc)
    known = await db.admin_devices.find_one({"fingerprint": fingerprint})
    if known:
        await db.admin_devices.update_one({"_id": known["_id"]}, {"$set": {"last_seen": now.isoformat()}})
        return
    await db.admin_devices.insert_one({"fingerprint": fingerprint, "ip": ip, "user_agent": ua,
                                       "label": _device_label(ua), "first_seen": now.isoformat(), "last_seen": now.isoformat()})
    logger.info("New admin device sign-in from %s (%s)", ip, _device_label(ua))
    try:
        await send_email(to=OWNER_EMAIL, subject="Security alert: admin signed in from a new device",
                         html=_new_device_email_html(ip, _device_label(ua), now.strftime("%d %b %Y, %H:%M UTC")))
        logger.info("New-device admin alert emailed to %s", OWNER_EMAIL)
    except Exception as exc:
        logger.error("New-device admin alert email failed: %s", exc)


@api_router.post("/auth/session", response_model=UserOut)
async def google_session(payload: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": payload.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    data = resp.json()
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        if existing.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Admin accounts must sign in via the Owner Security Gate.")
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": existing.get("name") or data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": data.get("name") or email, "picture": data.get("picture"),
                                   "role": "guest", "created_at": datetime.now(timezone.utc).isoformat()})
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": data["session_token"],
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                                       "created_at": datetime.now(timezone.utc).isoformat()})
    _set_cookie(response, "session_token", data["session_token"], 604800)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return UserOut(**user)


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@api_router.get("/config")
async def public_config():
    return {
        "brand_name": "BDS Marvel",
        "payments_enabled": bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET),
        "email_configured": bool(EMAIL_KEY),
    }


@api_router.get("/auth/status")
async def auth_status(request: Request, response: Response):
    """Quiet session probe: always 200. Returns {"user": UserOut|null, "payments_enabled": bool}.
    Silently refreshes the access cookie when it is expired but the refresh token is valid."""
    payments_enabled = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
    try:
        user = await get_current_user(request)
        return {"user": UserOut(**user).model_dump(), "payments_enabled": payments_enabled}
    except HTTPException:
        pass
    token = request.cookies.get("refresh_token")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "refresh":
                user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
                if user:
                    _set_cookie(response, "access_token", _jwt(payload["sub"], "access", timedelta(minutes=15)), 900)
                    return {"user": UserOut(**user).model_dump(), "payments_enabled": payments_enabled}
        except jwt.InvalidTokenError:
            pass
    return {"user": None, "payments_enabled": payments_enabled}


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    try:
        payload = jwt.decode(token or "", JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh" or not await db.users.find_one({"user_id": payload["sub"]}, {"_id": 1}):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    _set_cookie(response, "access_token", _jwt(payload["sub"], "access", timedelta(minutes=15)), 900)
    return {"ok": True}


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    for key in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(key, path="/", secure=True, samesite="none")
    return {"ok": True}


# --- Stay bookings v2 (guided checkout: request vs instant book) ---

class StayBookingCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Price, capacity, display name and confirmation policy are always loaded
    # from the server-side stay catalogue. Legacy client fields are ignored.
    stay_slug: str = Field(min_length=1, max_length=120)
    check_in: str
    check_out: str
    adults: int = Field(ge=1, le=16)
    children: int = Field(default=0, ge=0, le=16)
    infants: int = Field(default=0, ge=0, le=5)
    pets: int = Field(default=0, ge=0, le=5)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    message: Optional[str] = Field(default=None, max_length=1000)


class StayBooking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    reference: str
    user_id: str
    stay: str
    stay_slug: str
    mode: str
    status: str
    check_in: str
    check_out: str
    nights: int
    guests: int
    adults: int
    children: int
    infants: int
    pets: int
    nightly: int
    total: int
    name: str
    email: str
    phone: str
    message: Optional[str] = None
    created_at: str


async def _confirmed_overlap(stay: str, check_in: str, check_out: str, exclude_id: str | None = None):
    query = {"stay": stay, "status": "confirmed", "check_in": {"$lt": check_out}, "check_out": {"$gt": check_in}}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return await db.bookings.find_one(query, {"_id": 0, "check_in": 1, "check_out": 1})


def _guest_booking_email_html(bk: "StayBooking", trip_url: str | None) -> str:
    confirmed = bk.status == "confirmed"
    rows = _email_row("Stay", escape(bk.stay))
    rows += _email_row("Dates", f'{escape(bk.check_in)} &rarr; {escape(bk.check_out)}')
    rows += _email_row("Guests", str(bk.guests))
    rows += _email_row("Total", f'&#8377;{bk.total:,} &middot; {bk.nights} night{"s" if bk.nights > 1 else ""}')
    rows += _email_row("Reference", escape(bk.reference))
    rows += _email_row("Status", "Confirmed" if confirmed else "Pending host approval")
    if trip_url:
        rows += _email_row("Your trip", f'<a href="{escape(trip_url)}" style="color:#141414">View your booking</a>')
    note = ("Check-in details and arrival notes follow by email. Payment is made at the property - no online charge has been taken."
            if confirmed else
            "The host reviews requests within one working day. This is not a confirmed booking yet - we will email you as soon as it is approved.")
    rows += _email_row("What's next", escape(note))
    title = f"You're booked - {escape(bk.stay)}" if confirmed else f"Request received - {escape(bk.stay)}"
    return _email_shell("STAY BOOKING", title, rows, "stays page")


@api_router.post("/stays/bookings", response_model=StayBooking, status_code=201)
async def create_stay_booking(payload: StayBookingCreate, request: Request, user: dict = Depends(get_current_user)):
    if callable(globals().get("rate_limit")):
        await rate_limit("stay_bookings", max_requests=20, window_seconds=600)(request)
    stay_record = await db.stays.find_one({"$or": [{"slug": payload.stay_slug}, {"name": payload.stay_slug}]}, {"_id": 0})
    if not stay_record:
        try:
            catalogue = json.loads((ROOT_DIR / "stays.json").read_text())
            stay_record = next((item for item in catalogue if item.get("slug") == payload.stay_slug or item.get("name") == payload.stay_slug), None)
        except (OSError, json.JSONDecodeError):
            logger.exception("Server-side stay catalogue is unavailable")
            raise HTTPException(status_code=503, detail="Booking is temporarily unavailable.")
    if not stay_record:
        raise HTTPException(status_code=404, detail="Stay not found.")
    stay_name = str(stay_record["name"])
    nightly = max(0, int(stay_record["nightly"]))
    capacity = max(1, int(stay_record["guests"]))
    mode = "instant" if stay_record.get("booking_mode") == "instant" else "request"
    try:
        check_in = datetime.strptime(payload.check_in, "%Y-%m-%d").date()
        check_out = datetime.strptime(payload.check_out, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if check_in < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=422, detail="Check-in can't be in the past.")
    if check_out <= check_in:
        raise HTTPException(status_code=422, detail="Check-out must be after check-in.")
    guests = payload.adults + payload.children
    if guests > capacity:
        raise HTTPException(status_code=422, detail=f"This stay sleeps up to {capacity} guests.")
    nights = (check_out - check_in).days
    data = payload.model_dump()
    data.update({"stay": stay_name, "stay_slug": stay_record["slug"], "mode": mode, "nightly": nightly})
    booking = StayBooking(**data, id=str(uuid.uuid4()), reference=f"BDS-{secrets.token_hex(3).upper()}", user_id=user["user_id"],
                          status="confirmed" if mode == "instant" else "requested", nights=nights, guests=guests,
                          total=nightly * nights, created_at=datetime.now(timezone.utc).isoformat())
    if booking.status == "confirmed":
        # Serialize check-and-insert per listing so simultaneous requests cannot
        # both pass the overlap check before either becomes visible.
        lock_id = await _with_booking_lock(stay_record["slug"], booking.id)
        try:
            clash = await _confirmed_overlap(stay_name, payload.check_in, payload.check_out)
            if clash:
                raise HTTPException(status_code=409, detail=f"Those nights are already booked ({clash['check_in']} to {clash['check_out']}). Please pick different dates.")
            await db.bookings.insert_one(booking.model_dump())
        finally:
            await db.booking_locks.delete_one({"_id": lock_id, "owner": booking.id})
    else:
        await db.bookings.insert_one(booking.model_dump())
    logger.info("Stay booking %s (%s) for %s by %s", booking.reference, booking.status, booking.stay, booking.email)
    try:
        legacy = Booking(stay=booking.stay, name=booking.name, email=booking.email, check_in=booking.check_in, check_out=booking.check_out,
                         guests=booking.guests, message=f"[{booking.reference} · {booking.mode} · {booking.status}] {booking.message or ''}")
        await send_email(to=OWNER_EMAIL, subject=f"{'New reservation' if booking.mode == 'instant' else 'New booking request'} - {booking.stay} ({booking.reference})",
                         html=_booking_email_html(legacy))
    except Exception as exc:
        logger.error("Stay booking saved but email notification failed: %s", exc)
    try:
        origin = request.headers.get("origin", "")
        host = request.headers.get("host", "")
        trip_url = f"{origin}/stays/trips/{booking.id}" if origin.startswith("https://") and urlparse(origin).netloc == host else None
        await send_email(to=booking.email,
                         subject=f"{'Booking confirmed' if booking.status == 'confirmed' else 'Booking request received'} - {booking.stay} ({booking.reference})",
                         html=_guest_booking_email_html(booking, trip_url))
        logger.info("Guest booking confirmation emailed to %s", booking.email)
    except Exception as exc:
        logger.error("Stay booking saved but guest confirmation email failed: %s", exc)
    return booking


@api_router.get("/stays/bookings/mine", response_model=List[StayBooking])
async def my_stay_bookings(user: dict = Depends(get_current_user)):
    return await db.bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.get("/stays/bookings/{booking_id}", response_model=StayBooking)
async def get_stay_booking(booking_id: str, user: dict = Depends(get_current_user)):
    doc = await db.bookings.find_one({"id": booking_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    return doc


class PaymentOrderCreate(BaseModel):
    stay_slug: str
    check_in: str
    check_out: str
    adults: int = Field(ge=1, le=20)
    children: int = Field(default=0, ge=0, le=20)
    infants: int = Field(default=0, ge=0, le=10)
    pets: int = Field(default=0, ge=0, le=5)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=40)
    message: Optional[str] = Field(default=None, max_length=2000)


class PaymentVerifyIn(BaseModel):
    booking_id: str = Field(min_length=1, max_length=100)
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=128)


@api_router.post("/stays/payments/orders", status_code=201)
async def create_stay_payment_order(payload: PaymentOrderCreate, request: Request, user: dict = Depends(get_current_user)):
    stay_record = await db.stays.find_one({"$or": [{"slug": payload.stay_slug}, {"name": payload.stay_slug}]}, {"_id": 0})
    if not stay_record:
        try:
            catalogue = json.loads((ROOT_DIR / "stays.json").read_text())
            stay_record = next((item for item in catalogue if item.get("slug") == payload.stay_slug or item.get("name") == payload.stay_slug), None)
        except (OSError, json.JSONDecodeError):
            logger.exception("Server-side stay catalogue is unavailable")
            raise HTTPException(status_code=503, detail="Booking is temporarily unavailable.")
    if not stay_record:
        raise HTTPException(status_code=404, detail="Stay not found.")
    stay_name = str(stay_record["name"])
    nightly = max(0, int(stay_record["nightly"]))
    capacity = max(1, int(stay_record["guests"]))
    mode = "instant" if stay_record.get("booking_mode") == "instant" else "request"

    try:
        check_in = datetime.strptime(payload.check_in, "%Y-%m-%d").date()
        check_out = datetime.strptime(payload.check_out, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if check_in < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=422, detail="Check-in can't be in the past.")
    if check_out <= check_in:
        raise HTTPException(status_code=422, detail="Check-out must be after check-in.")
    guests = payload.adults + payload.children
    if guests > capacity:
        raise HTTPException(status_code=422, detail=f"This stay sleeps up to {capacity} guests.")
    nights = (check_out - check_in).days
    total = nightly * nights
    booking_id = str(uuid.uuid4())
    reference = f"BDS-{secrets.token_hex(3).upper()}"

    lock_id = await _with_booking_lock(stay_record["slug"], booking_id)
    try:
        clash = await _confirmed_overlap(stay_name, payload.check_in, payload.check_out)
        if clash:
            raise HTTPException(status_code=409, detail=f"Those nights are already booked ({clash['check_in']} to {clash['check_out']}). Please pick different dates.")

        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
            data = {
                "id": booking_id,
                "reference": reference,
                "user_id": user["user_id"],
                "stay": stay_name,
                "stay_slug": stay_record["slug"],
                "mode": "request",
                "status": "requested",
                "payment_status": "not_required",
                "payment_provider": "",
                "check_in": payload.check_in,
                "check_out": payload.check_out,
                "nights": nights,
                "adults": payload.adults,
                "children": payload.children,
                "infants": payload.infants,
                "pets": payload.pets,
                "guests": guests,
                "nightly": nightly,
                "total": total,
                "name": payload.name,
                "email": payload.email,
                "phone": payload.phone,
                "message": payload.message,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.bookings.insert_one(data)
            booking_doc = {k: v for k, v in data.items() if k != "_id"}
            try:
                legacy = Booking(stay=stay_name, name=payload.name, email=payload.email, check_in=payload.check_in,
                                 check_out=payload.check_out, guests=guests,
                                 message=f"[{reference} · request · requested] {payload.message or ''}")
                await send_email(to=OWNER_EMAIL, subject=f"New booking request - {stay_name} ({reference})",
                                 html=_booking_email_html(legacy))
            except Exception as e:
                logger.error("Owner notification failed for booking request %s: %s", reference, e)
            return {"booking": booking_doc, "payment_required": False}

        amount_paise = total * 100
        order_payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"bds_{uuid.uuid4().hex[:16]}",
            "notes": {"booking_id": booking_id, "stay_slug": stay_record["slug"], "booking_reference": reference},
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                    json=order_payload,
                )
            res.raise_for_status()
            remote_order = res.json()
        except Exception as e:
            logger.error("Razorpay order creation failed: %s", e)
            raise HTTPException(status_code=502, detail="The payment service is temporarily unavailable. Please try again.")

        data = {
            "id": booking_id,
            "reference": reference,
            "user_id": user["user_id"],
            "stay": stay_name,
            "stay_slug": stay_record["slug"],
            "mode": mode,
            "status": "payment_pending",
            "payment_status": "pending",
            "payment_provider": "razorpay",
            "razorpay_order_id": remote_order["id"],
            "check_in": payload.check_in,
            "check_out": payload.check_out,
            "nights": nights,
            "adults": payload.adults,
            "children": payload.children,
            "infants": payload.infants,
            "pets": payload.pets,
            "guests": guests,
            "nightly": nightly,
            "total": total,
            "name": payload.name,
            "email": payload.email,
            "phone": payload.phone,
            "message": payload.message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.bookings.insert_one(data)
        booking_doc = {k: v for k, v in data.items() if k != "_id"}
        return {
            "booking": booking_doc,
            "order_id": remote_order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "payment_required": True,
        }
    finally:
        await db.booking_locks.delete_one({"_id": lock_id, "owner": booking_id})


@api_router.post("/stays/payments/verify")
async def verify_stay_payment(payload: PaymentVerifyIn, request: Request, user: dict = Depends(get_current_user)):
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Online payment is not configured.")

    target = await db.bookings.find_one({"id": payload.booking_id, "user_id": user["user_id"]}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if target.get("razorpay_order_id") != payload.razorpay_order_id or target.get("payment_provider") != "razorpay":
        raise HTTPException(status_code=400, detail="Payment order does not match this stay.")

    expected_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_sig, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment signature could not be verified.")

    if target.get("payment_status") == "paid":
        return target

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.razorpay.com/v1/payments/{payload.razorpay_payment_id}",
                auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            )
        resp.raise_for_status()
        payment_info = resp.json()
    except Exception as e:
        logger.error("Razorpay payment verification request failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not verify payment with processor.")

    if payment_info.get("order_id") != payload.razorpay_order_id or int(payment_info.get("amount", 0)) != target["total"] * 100:
        raise HTTPException(status_code=400, detail="Payment amount or order does not match this stay.")

    lock_id = await _with_booking_lock(target["stay_slug"], payload.booking_id)
    try:
        clash = await _confirmed_overlap(target["stay"], target["check_in"], target["check_out"], exclude_id=payload.booking_id)
        if clash:
            await db.bookings.update_one(
                {"id": payload.booking_id},
                {"$set": {"status": "payment_conflict", "payment_status": "paid_conflict", "payment_id": payload.razorpay_payment_id}}
            )
            raise HTTPException(status_code=409, detail="Payment was received, but these dates were just taken. Please contact BDS Marvel for a refund.")

        new_status = "confirmed" if target.get("mode") == "instant" else "requested"
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.bookings.update_one(
            {"id": payload.booking_id},
            {"$set": {
                "status": new_status,
                "payment_status": "paid",
                "payment_id": payload.razorpay_payment_id,
                "paid_at": now_iso
            }}
        )
    finally:
        await db.booking_locks.delete_one({"_id": lock_id, "owner": payload.booking_id})

    updated = await db.bookings.find_one({"id": payload.booking_id}, {"_id": 0})
    try:
        sb = StayBooking(**updated)
        origin = request.headers.get("origin", "")
        host = request.headers.get("host", "")
        trip_url = f"{origin}/stays/trips/{updated['id']}" if origin.startswith("https://") and urlparse(origin).netloc == host else None
        await send_email(to=updated["email"],
                         subject=f"{'Booking confirmed' if updated['status'] == 'confirmed' else 'Booking request received'} - {updated['stay']} ({updated['reference']})",
                         html=_guest_booking_email_html(sb, trip_url))
        legacy = Booking(stay=updated["stay"], name=updated["name"], email=updated["email"], check_in=updated["check_in"],
                         check_out=updated["check_out"], guests=updated["guests"],
                         message=f"[{updated['reference']} · {updated['mode']} · {updated['status']}]")
        await send_email(to=OWNER_EMAIL,
                         subject=f"BDS Marvel — {'paid reservation' if updated['status'] == 'confirmed' else 'paid booking request'} ({updated['reference']})",
                         html=_booking_email_html(legacy))
    except Exception as e:
        logger.error("Notification emails failed after payment verification: %s", e)

    return updated


RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")


@api_router.post("/stays/payments/webhook")
async def razorpay_webhook(request: Request):
    if not RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Payment webhook is not configured.")
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing webhook signature.")
    expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")
    try:
        event_data = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = event_data.get("event")
    if event in ("payment.captured", "order.paid"):
        payment_entity = event_data.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id")
        if order_id:
            target = await db.bookings.find_one({"razorpay_order_id": order_id}, {"_id": 0})
            if target and target.get("payment_status") != "paid":
                lock_id = await _with_booking_lock(target["stay_slug"], target["id"])
                try:
                    clash = await _confirmed_overlap(target["stay"], target["check_in"], target["check_out"], exclude_id=target["id"])
                    if clash:
                        await db.bookings.update_one(
                            {"id": target["id"]},
                            {"$set": {"status": "payment_conflict", "payment_status": "paid_conflict", "payment_id": payment_id}}
                        )
                        logger.warning("Webhook: payment for %s conflicted with existing booking", target["id"])
                    else:
                        new_status = "confirmed" if target.get("mode") == "instant" else "requested"
                        await db.bookings.update_one(
                            {"id": target["id"]},
                            {"$set": {
                                "status": new_status,
                                "payment_status": "paid",
                                "payment_id": payment_id,
                                "paid_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        logger.info("Webhook: booking %s marked %s via %s", target["id"], new_status, event)
                finally:
                    await db.booking_locks.delete_one({"_id": lock_id, "owner": target["id"]})
    elif event == "payment.failed":
        payment_entity = event_data.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        if order_id:
            await db.bookings.update_one(
                {"razorpay_order_id": order_id, "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "failed"}}
            )
            logger.info("Webhook: booking payment for order %s failed", order_id)
    elif event == "refund.processed":
        refund_entity = event_data.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = refund_entity.get("payment_id")
        refund_id = refund_entity.get("id")
        if payment_id:
            await db.bookings.update_one(
                {"payment_id": payment_id},
                {"$set": {
                    "payment_status": "refunded",
                    "status": "cancelled",
                    "refund_id": refund_id,
                    "refunded_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info("Webhook: refund processed for payment %s (refund %s)", payment_id, refund_id)
    elif event == "refund.failed":
        refund_entity = event_data.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = refund_entity.get("payment_id")
        if payment_id:
            await db.bookings.update_one(
                {"payment_id": payment_id},
                {"$set": {"payment_status": "refund_failed"}}
            )
            logger.warning("Webhook: refund failed for payment %s", payment_id)

    return {"status": "ok"}


class AdminStatusUpdate(BaseModel):
    status: Literal["requested", "confirmed", "declined", "cancelled"]


@api_router.get("/admin/2fa/status")
async def admin_2fa_status(admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"user_id": admin["user_id"]}, {"_id": 0})
    enabled = bool((user or {}).get("totp_enabled") or os.environ.get("ADMIN_TOTP_SECRET"))
    return {
        "enabled": enabled,
        "email": admin.get("email"),
    }


@api_router.post("/admin/2fa/setup")
async def admin_2fa_setup(admin: dict = Depends(require_admin)):
    raw_secret = base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")
    await db.users.update_one({"user_id": admin["user_id"]}, {"$set": {"temp_totp_secret": raw_secret}})
    issuer = "BDS Marvel"
    otpauth_url = f"otpauth://totp/{issuer}:{admin['email']}?secret={raw_secret}&issuer={issuer}"
    return {
        "secret": raw_secret,
        "otpauth_url": otpauth_url
    }


@api_router.post("/admin/2fa/enable")
async def admin_2fa_enable(payload: MfaSetupIn, admin: dict = Depends(require_admin), request: Request = None):
    user = await db.users.find_one({"user_id": admin["user_id"]})
    secret = (user or {}).get("temp_totp_secret") or (user or {}).get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="No 2FA setup in progress. Call setup first.")
    if not verify_totp(secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code. Please check your authenticator app.")

    await db.users.update_one(
        {"user_id": admin["user_id"]},
        {"$set": {"totp_secret": secret, "totp_enabled": True}, "$unset": {"temp_totp_secret": ""}}
    )
    await log_admin_action(admin, "enable_2fa", f"user:{admin['user_id']}", request=request)
    return {"status": "ok", "message": "Two-factor authentication successfully enabled."}


@api_router.post("/admin/2fa/disable")
async def admin_2fa_disable(payload: dict, admin: dict = Depends(require_admin), request: Request = None):
    code = payload.get("code", "")
    password = payload.get("password", "")
    user = await db.users.find_one({"user_id": admin["user_id"]})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    secret = (user or {}).get("totp_secret") or os.environ.get("ADMIN_TOTP_SECRET")
    if not secret or not verify_totp(secret, code):
        raise HTTPException(status_code=400, detail="Invalid two-factor verification code.")
    await db.users.update_one(
        {"user_id": admin["user_id"]},
        {"$set": {"totp_enabled": False}}
    )
    await log_admin_action(admin, "disable_2fa", f"user:{admin['user_id']}", request=request)
    return {"status": "ok", "message": "Two-factor authentication disabled."}


@api_router.get("/admin/audit-logs")
async def admin_audit_logs(limit: int = 50, _: dict = Depends(require_admin)):
    cursor = db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(min(limit, 100))
    return await cursor.to_list(min(limit, 100))


@api_router.get("/admin/overview")
async def admin_overview(_: dict = Depends(require_admin)):
    today = datetime.now(timezone.utc).date().isoformat()
    pending = await db.bookings.count_documents({"status": "requested"})
    upcoming = await db.bookings.count_documents({"status": "confirmed", "check_out": {"$gte": today}})
    total_bookings = await db.bookings.count_documents({})
    enquiries = 0
    for coll in ("inquiries", "consultations", "sample_requests", "product_inquiries", "quote_requests"):
        enquiries += await db[coll].count_documents({})
    return {"pending_requests": pending, "upcoming_stays": upcoming,
            "total_bookings": total_bookings, "total_enquiries": enquiries}


@api_router.get("/admin/bookings")
async def admin_list_bookings(_: dict = Depends(require_admin)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/bookings/{booking_id}/status")
async def admin_update_booking_status(booking_id: str, payload: AdminStatusUpdate, admin: dict = Depends(require_admin), request: Request = None):
    target = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Booking not found")
    if payload.status == "confirmed":
        lock_owner = f"admin:{uuid.uuid4()}"
        stay_slug = target.get("stay_slug")
        if not stay_slug:
            try:
                catalogue = json.loads((ROOT_DIR / "stays.json").read_text())
                stay_slug = next((item["slug"] for item in catalogue if item.get("name") == target["stay"]), target["stay"])
            except (OSError, json.JSONDecodeError):
                stay_slug = target["stay"]
        lock_id = await _with_booking_lock(stay_slug, lock_owner)
        try:
            clash = await _confirmed_overlap(target["stay"], target["check_in"], target["check_out"], exclude_id=booking_id)
            if clash:
                raise HTTPException(status_code=409, detail=f"Those nights are already confirmed for another guest ({clash['check_in']} to {clash['check_out']}).")
            await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "confirmed"}})
        finally:
            await db.booking_locks.delete_one({"_id": lock_id, "owner": lock_owner})
    else:
        await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status}})
    logger.info("Admin marked booking %s as %s", booking_id, payload.status)
    await log_admin_action(admin, "update_booking_status", f"booking:{booking_id}", {"new_status": payload.status}, request=request)
    return await db.bookings.find_one({"id": booking_id}, {"_id": 0})


class AdminRefundIn(BaseModel):
    reason: Optional[str] = "Admin requested refund"
    amount: Optional[int] = None


@api_router.post("/admin/bookings/{booking_id}/refund")
async def admin_refund_booking(booking_id: str, payload: AdminRefundIn = AdminRefundIn(), admin: dict = Depends(require_admin), request: Request = None):
    target = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if target.get("payment_status") == "refunded":
        raise HTTPException(status_code=400, detail="This booking has already been refunded.")

    payment_id = target.get("payment_id")
    refund_amount = payload.amount if payload.amount is not None else target.get("total", 0)
    refund_id = None
    refund_status = "refunded"
    refund_error = None

    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and payment_id:
        try:
            amount_paise = int(refund_amount * 100)
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    f"https://api.razorpay.com/v1/payments/{payment_id}/refund",
                    auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                    json={
                        "amount": amount_paise,
                        "notes": {"booking_id": booking_id, "reason": payload.reason or "Admin refund"},
                    },
                )
            if res.status_code >= 400:
                err_detail = res.json().get("error", {}).get("description", res.text)
                logger.error("Razorpay refund error for %s: %s", booking_id, err_detail)
                refund_status = "refund_failed"
                refund_error = err_detail
                raise HTTPException(status_code=502, detail=f"Razorpay refund failed: {err_detail}")
            data = res.json()
            refund_id = data.get("id")
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to connect to Razorpay for refund on %s: %s", booking_id, e)
            raise HTTPException(status_code=502, detail="Failed to connect to payment processor for refund.")
    else:
        refund_id = f"manual_{uuid.uuid4().hex[:8]}"

    now_iso = datetime.now(timezone.utc).isoformat()
    update_fields = {
        "status": "cancelled",
        "payment_status": refund_status,
        "refund_id": refund_id,
        "refund_amount": refund_amount,
        "refunded_at": now_iso,
    }
    if refund_error:
        update_fields["refund_error"] = refund_error

    await db.bookings.update_one({"id": booking_id}, {"$set": update_fields})
    await log_admin_action(admin, "refund_booking", f"booking:{booking_id}", {
        "amount": refund_amount,
        "refund_id": refund_id,
        "payment_id": payment_id,
        "reason": payload.reason,
    }, request=request)

    try:
        if target.get("email"):
            refund_subj = f"Refund issued for your stay at {target.get('stay', 'BDS Marvel')}"
            refund_body = f"<p>Hello {target.get('name', 'Guest')},</p><p>A refund of ₹{refund_amount:,} has been initiated for your booking reference <b>{target.get('reference')}</b>.</p><p>Refunds typically reflect in your bank account or payment method within 5–7 working days.</p>"
            await send_email(to=target["email"], subject=refund_subj, html=refund_body)
    except Exception as e:
        logger.error("Failed to send refund email to %s: %s", target.get("email"), e)

    return await db.bookings.find_one({"id": booking_id}, {"_id": 0})


@api_router.get("/admin/enquiries")
async def admin_list_enquiries(_: dict = Depends(require_admin)):
    sources = (("inquiries", "Contact"), ("consultations", "Consultation"),
               ("sample_requests", "Sample request"), ("product_inquiries", "Product inquiry"),
               ("quote_requests", "Quote request"))
    items = []
    for coll, label in sources:
        for doc in await db[coll].find({}, {"_id": 0}).to_list(500):
            doc["type"] = label
            items.append(doc)
    items.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return items[:500]


def _slugify(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", text.strip().lower())
    slug = re.sub(r"[\s_-]+", "-", cleaned).strip("-")
    return slug or f"item-{uuid.uuid4().hex[:6]}"


class CatalogueItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=120)
    brand: str = Field(default="DrawStones", max_length=100)
    category: str = Field(default="Marble & Stone", max_length=100)
    material: Optional[str] = Field(default="Marble", max_length=100)
    product: Optional[str] = Field(default="Materials", max_length=100)
    application: Optional[str] = Field(default="Interior", max_length=100)
    origin: Optional[str] = Field(default="", max_length=200)
    image: str = Field(min_length=1, max_length=1000)
    desc: Optional[str] = Field(default="", max_length=8000)
    specs: Optional[List[List[str]]] = Field(default_factory=list)
    gallery: Optional[List[str]] = Field(default_factory=list)
    is_active: bool = True


class StayIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=120)
    tier: Literal["Premium", "Mid", "Budget-friendly"] = "Premium"
    location: str = Field(min_length=1, max_length=200)
    city: Optional[str] = Field(default="", max_length=100)
    state: Optional[str] = Field(default="", max_length=100)
    nightly: int = Field(gt=0, le=1000000)
    guests: int = Field(gt=0, le=50)
    bedrooms: int = Field(default=1, gt=0, le=20)
    beds: int = Field(default=1, gt=0, le=30)
    baths: int = Field(default=1, gt=0, le=20)
    type: Optional[str] = Field(default="Villa", max_length=100)
    lat: Optional[float] = Field(default=20.5937)
    lng: Optional[float] = Field(default=78.9629)
    hero: str = Field(min_length=1, max_length=1000)
    gallery: Optional[List[str]] = Field(default_factory=list)
    blurb: Optional[str] = Field(default="", max_length=500)
    description: Optional[str] = Field(default="", max_length=8000)
    amenities: Optional[List[str]] = Field(default_factory=list)
    rules: Optional[List[str]] = Field(default_factory=list)
    booking_mode: Literal["request", "instant"] = "request"
    min_nights: int = Field(default=1, gt=0, le=90)
    is_active: bool = True


# --- Catalogue inventory endpoints ---

@api_router.get("/catalogue")
async def list_catalogue(brand: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None, all: bool = False):
    query = {}
    if not all:
        query["is_active"] = {"$ne": False}
    if brand and brand != "All":
        query["brand"] = brand
    if category and category != "All":
        query["category"] = category
    if q and q.strip():
        rgx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rgx}, {"slug": rgx}, {"desc": rgx}, {"material": rgx}, {"product": rgx}]

    docs = await db.catalogue.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    if not docs and not query:
        try:
            docs = json.loads((ROOT_DIR / "catalogue_seed.json").read_text())
        except Exception:
            docs = []
    return docs


@api_router.get("/catalogue/{slug}")
async def get_catalogue_item(slug: str):
    doc = await db.catalogue.find_one({"$or": [{"slug": slug}, {"id": slug}]}, {"_id": 0})
    if not doc:
        try:
            seed = json.loads((ROOT_DIR / "catalogue_seed.json").read_text())
            doc = next((item for item in seed if item.get("slug") == slug), None)
        except Exception:
            pass
    if not doc:
        raise HTTPException(status_code=404, detail="Catalogue item not found")
    return doc


@api_router.post("/admin/catalogue", status_code=201)
async def admin_create_catalogue_item(payload: CatalogueItemIn, _: dict = Depends(require_admin), request: Request = None):
    data = payload.model_dump()
    slug = (data.get("slug") or "").strip() or _slugify(data["name"])
    existing = await db.catalogue.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    data["slug"] = slug
    data["id"] = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    data["created_at"] = now
    data["updated_at"] = now
    await db.catalogue.insert_one(data)
    created = await db.catalogue.find_one({"id": data["id"]}, {"_id": 0})
    await log_admin_action(_, "create_catalogue_item", f"catalogue:{slug}", {"name": data["name"]}, request=request)
    return created


@api_router.put("/admin/catalogue/{identifier}")
async def admin_update_catalogue_item(identifier: str, payload: CatalogueItemIn, _: dict = Depends(require_admin), request: Request = None):
    target = await db.catalogue.find_one({"$or": [{"id": identifier}, {"slug": identifier}]})
    if not target:
        raise HTTPException(status_code=404, detail="Catalogue item not found")
    data = payload.model_dump()
    if data.get("slug") and data["slug"] != target.get("slug"):
        clash = await db.catalogue.find_one({"slug": data["slug"], "id": {"$ne": target["id"]}})
        if clash:
            raise HTTPException(status_code=409, detail="A catalogue item with this slug already exists.")
    else:
        data["slug"] = target["slug"]
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.catalogue.update_one({"id": target["id"]}, {"$set": data})
    await log_admin_action(_, "update_catalogue_item", f"catalogue:{target['id']}", {"slug": data["slug"]}, request=request)
    return await db.catalogue.find_one({"id": target["id"]}, {"_id": 0})


@api_router.delete("/admin/catalogue/{identifier}")
async def admin_delete_catalogue_item(identifier: str, _: dict = Depends(require_admin), request: Request = None):
    target = await db.catalogue.find_one({"$or": [{"id": identifier}, {"slug": identifier}]})
    if not target:
        raise HTTPException(status_code=404, detail="Catalogue item not found")
    await db.catalogue.delete_one({"id": target["id"]})
    await log_admin_action(_, "delete_catalogue_item", f"catalogue:{target['id']}", {"slug": target["slug"]}, request=request)
    return {"status": "ok", "deleted_id": target["id"], "slug": target["slug"]}


# --- Airbnb stays endpoints ---

@api_router.get("/stays")
async def list_stays(tier: Optional[str] = None, q: Optional[str] = None, all: bool = False):
    query = {}
    if not all:
        query["is_active"] = {"$ne": False}
    if tier and tier != "All":
        query["tier"] = tier
    if q and q.strip():
        rgx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rgx}, {"slug": rgx}, {"location": rgx}, {"city": rgx}, {"description": rgx}]

    docs = await db.stays.find(query, {"_id": 0}).sort("nightly", -1).to_list(500)
    if not docs and not query:
        try:
            docs = json.loads((ROOT_DIR / "stays_seed.json").read_text())
        except Exception:
            docs = []
    return docs


@api_router.get("/stays/{slug}")
async def get_stay(slug: str):
    doc = await db.stays.find_one({"$or": [{"slug": slug}, {"id": slug}]}, {"_id": 0})
    if not doc:
        try:
            seed = json.loads((ROOT_DIR / "stays_seed.json").read_text())
            doc = next((item for item in seed if item.get("slug") == slug), None)
        except Exception:
            pass
    if not doc:
        raise HTTPException(status_code=404, detail="Stay not found")
    return doc


@api_router.post("/admin/stays", status_code=201)
async def admin_create_stay(payload: StayIn, _: dict = Depends(require_admin), request: Request = None):
    data = payload.model_dump()
    slug = (data.get("slug") or "").strip() or _slugify(data["name"])
    existing = await db.stays.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    data["slug"] = slug
    data["id"] = str(uuid.uuid4())
    data["price"] = f"₹{data['nightly']:,}"
    if not data.get("city") and "," in data.get("location", ""):
        parts = [p.strip() for p in data["location"].split(",")]
        data["city"] = parts[0]
        if len(parts) > 1 and not data.get("state"):
            data["state"] = parts[1]
    now = datetime.now(timezone.utc).isoformat()
    data["created_at"] = now
    data["updated_at"] = now
    await db.stays.insert_one(data)
    created = await db.stays.find_one({"id": data["id"]}, {"_id": 0})
    await log_admin_action(_, "create_stay", f"stay:{slug}", {"name": data["name"]}, request=request)
    return created


@api_router.put("/admin/stays/{identifier}")
async def admin_update_stay(identifier: str, payload: StayIn, _: dict = Depends(require_admin), request: Request = None):
    target = await db.stays.find_one({"$or": [{"id": identifier}, {"slug": identifier}]})
    if not target:
        raise HTTPException(status_code=404, detail="Stay not found")
    data = payload.model_dump()
    if data.get("slug") and data["slug"] != target.get("slug"):
        clash = await db.stays.find_one({"slug": data["slug"], "id": {"$ne": target["id"]}})
        if clash:
            raise HTTPException(status_code=409, detail="A stay with this slug already exists.")
    else:
        data["slug"] = target["slug"]
    data["price"] = f"₹{data['nightly']:,}"
    if not data.get("city") and "," in data.get("location", ""):
        parts = [p.strip() for p in data["location"].split(",")]
        data["city"] = parts[0]
        if len(parts) > 1 and not data.get("state"):
            data["state"] = parts[1]
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.stays.update_one({"id": target["id"]}, {"$set": data})
    await log_admin_action(_, "update_stay", f"stay:{target['id']}", {"slug": data["slug"]}, request=request)
    return await db.stays.find_one({"id": target["id"]}, {"_id": 0})


@api_router.delete("/admin/stays/{identifier}")
async def admin_delete_stay(identifier: str, _: dict = Depends(require_admin), request: Request = None):
    target = await db.stays.find_one({"$or": [{"id": identifier}, {"slug": identifier}]})
    if not target:
        raise HTTPException(status_code=404, detail="Stay not found")
    await db.stays.delete_one({"id": target["id"]})
    await log_admin_action(_, "delete_stay", f"stay:{target['id']}", {"slug": target["slug"]}, request=request)
    return {"status": "ok", "deleted_id": target["id"], "slug": target["slug"]}


# --- Media upload & serving endpoints ---

@api_router.post("/admin/media/upload")
async def admin_upload_media(file: UploadFile = File(...), admin: dict = Depends(require_admin), request: Request = None):
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 15MB)")
    filename = (file.filename or "upload")[-200:]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("jpg", "jpeg", "png", "webp", "gif") or not _magic_ok(ext, data):
        raise HTTPException(status_code=415, detail="Only JPG, PNG, WEBP, or GIF images are allowed.")
    media_id = f"img_{uuid.uuid4().hex[:12]}.{ext}"
    saved_path = f"{APP_NAME}/media/{media_id}"
    try:
        put_object(saved_path, data, _MIME_TYPES[ext])
    except Exception as exc:
        logger.error("Media upload put_object failed: %s", exc)
        local_dest = UPLOAD_DIR / media_id
        local_dest.write_bytes(data)

    url = f"/api/media/{media_id}"
    await log_admin_action(admin, "upload_media", f"media:{media_id}", {"filename": filename, "size": len(data)}, request=request)
    return {"url": url, "filename": media_id, "size": len(data), "content_type": _MIME_TYPES[ext]}


@api_router.get("/media/{filename}")
async def get_media_file(filename: str):
    if not re.fullmatch(r"^[a-zA-Z0-9_\-\.]+$", filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ct = _MIME_TYPES.get(ext, "image/jpeg")
    local_path = UPLOAD_DIR / filename
    if local_path.exists() and local_path.is_file():
        return Response(content=local_path.read_bytes(), media_type=ct, headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=86400"})
    try:
        data, content_type = get_object(f"{APP_NAME}/media/{filename}")
        return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=86400"})
    except Exception:
        raise HTTPException(status_code=404, detail="Media file not found")


@app.on_event("startup")
async def startup_auth():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    # Convert legacy ISO-string timestamps so TTL cleanup also covers existing
    # sessions and failed-login records created before these indexes existed.
    await db.user_sessions.update_many(
        {"expires_at": {"$type": "string"}},
        [{"$set": {"expires_at": {"$convert": {"input": "$expires_at", "to": "date", "onError": datetime.now(timezone.utc), "onNull": datetime.now(timezone.utc)}}}}],
    )
    await db.login_attempts.update_many(
        {"updated_at": {"$type": "string"}},
        [{"$set": {"updated_at": {"$convert": {"input": "$updated_at", "to": "date", "onError": datetime.now(timezone.utc), "onNull": datetime.now(timezone.utc)}}}}],
    )
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    # Expire abandoned auth/rate-limit state and accelerate booking lookups.
    await db.login_attempts.create_index("updated_at", expireAfterSeconds=86400)
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.bookings.create_index([("stay", 1), ("status", 1), ("check_in", 1), ("check_out", 1)])
    await db.bookings.create_index([("user_id", 1), ("created_at", -1)])

    # Seed catalogue collection if empty
    try:
        await db.catalogue.create_index("slug", unique=True)
        await db.catalogue.create_index([("brand", 1), ("category", 1)])
        if await db.catalogue.count_documents({}) == 0:
            seed_path = ROOT_DIR / "catalogue_seed.json"
            if seed_path.exists():
                cat_items = json.loads(seed_path.read_text())
                now = datetime.now(timezone.utc).isoformat()
                for it in cat_items:
                    it.setdefault("id", str(uuid.uuid4()))
                    it.setdefault("created_at", now)
                    it.setdefault("updated_at", now)
                if cat_items:
                    await db.catalogue.insert_many(cat_items)
                    logger.info("Seeded %d catalogue items into db.catalogue", len(cat_items))
    except Exception as e:
        logger.warning("Catalogue seeding notice: %s", e)

    # Seed stays collection if empty
    try:
        await db.stays.create_index("slug", unique=True)
        await db.stays.create_index([("tier", 1), ("is_active", 1)])
        if await db.stays.count_documents({}) == 0:
            stays_seed_path = ROOT_DIR / "stays_seed.json"
            if not stays_seed_path.exists():
                stays_seed_path = ROOT_DIR / "stays.json"
            if stays_seed_path.exists():
                stay_items = json.loads(stays_seed_path.read_text())
                now = datetime.now(timezone.utc).isoformat()
                for it in stay_items:
                    it.setdefault("id", str(uuid.uuid4()))
                    it.setdefault("created_at", now)
                    it.setdefault("updated_at", now)
                if stay_items:
                    await db.stays.insert_many(stay_items)
                    logger.info("Seeded %d stays into db.stays", len(stay_items))
    except Exception as e:
        logger.warning("Stays seeding notice: %s", e)

    admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
    if admin_email:
        existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
        admins = await db.users.count_documents({"role": "admin"})
        totp_sec = os.environ.get("ADMIN_TOTP_SECRET", "").strip()
        if admins == 0 and not existing:
            admin_password = os.environ.get("ADMIN_PASSWORD")
            if not admin_password:
                admin_password = secrets.token_urlsafe(24)
                logger.critical("SECURITY ALERT: No ADMIN_PASSWORD set in environment. Generated one-time password: %s", admin_password)
            doc = {
                "user_id": f"user_{uuid.uuid4().hex[:12]}",
                "email": admin_email,
                "name": "BDS Marvel Admin",
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            if totp_sec:
                doc["totp_secret"] = totp_sec
                doc["totp_enabled"] = True
            await db.users.insert_one(doc)
        elif existing and totp_sec and not existing.get("totp_enabled"):
            await db.users.update_one({"email": admin_email}, {"$set": {"totp_secret": totp_sec, "totp_enabled": True}})
        elif admins == 0:
            logger.error("No admin account exists; refusing to promote or reset %s automatically. Repair the account role explicitly.", admin_email)


# Include the router in the main app
app.include_router(api_router)

cors_env = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in cors_env.split(",") if o.strip() and o.strip() != "*"]


@app.middleware("http")
async def origin_guard_and_headers(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl and cl.isdigit():
        max_bytes = 20 * 1024 * 1024 if request.url.path.endswith("/upload") else 2 * 1024 * 1024
        if int(cl) > max_bytes:
            return Response(content='{"detail":"Payload too large"}', status_code=413, media_type="application/json")

    origin = request.headers.get("origin")
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and origin:
        host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        if origin.rstrip("/") not in ALLOWED_ORIGINS and urlparse(origin).netloc != host:
            return Response(content='{"detail":"Origin not allowed"}', status_code=403, media_type="application/json")
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self 'https://api.razorpay.com')")
    response.headers.setdefault("X-XSS-Protection", "1; mode=block")
    if request.method == "GET" and (request.url.path == "/api/stays/availability" or request.url.path.startswith("/api/media/")) and response.status_code < 400:
        response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=86400"
    else:
        response.headers["Cache-Control"] = "no-store"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
