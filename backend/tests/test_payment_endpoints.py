"""Offline tests for payment order and verification endpoints."""
import ast
import asyncio
import hashlib
import hmac
import json
import secrets
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend/server.py"


def load_functions(names, namespace):
    nodes = [
        node for node in ast.parse(SERVER.read_text()).body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names
    ]
    for node in nodes:
        node.decorator_list = []
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SERVER), "exec"), namespace)
    return namespace


class Record(SimpleNamespace):
    def model_dump(self):
        return {k: v for k, v in vars(self).items() if not k.startswith("_")}


class HTTPError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail
        super().__init__(status_code, detail)


class PaymentEndpointsTests(unittest.TestCase):
    def setUp(self):
        self.db = SimpleNamespace(
            bookings=SimpleNamespace(
                insert_one=AsyncMock(),
                find_one=AsyncMock(),
                update_one=AsyncMock(),
            ),
            booking_locks=SimpleNamespace(
                delete_one=AsyncMock(),
            ),
            stays=SimpleNamespace(
                find_one=AsyncMock(return_value=None),
            ),
        )
        self.ns = load_functions(
            {"create_stay_payment_order", "verify_stay_payment", "public_config", "razorpay_webhook", "admin_refund_booking"},
            {
                "PaymentOrderCreate": Record,
                "PaymentVerifyIn": Record,
                "AdminRefundIn": Record,
                "StayBooking": Record,
                "Booking": Record,
                "Request": object,
                "Depends": lambda value: None,
                "get_current_user": None,
                "require_admin": None,
                "log_admin_action": AsyncMock(),
                "ROOT_DIR": ROOT / "backend",
                "json": json,
                "datetime": datetime,
                "timezone": timezone,
                "uuid": uuid,
                "secrets": secrets,
                "hmac": hmac,
                "hashlib": hashlib,
                "db": self.db,
                "HTTPException": HTTPError,
                "logger": SimpleNamespace(info=lambda *a: None, error=lambda *a: None, warning=lambda *a: None, exception=lambda *a: None),
                "RAZORPAY_KEY_ID": "",
                "RAZORPAY_KEY_SECRET": "",
                "RAZORPAY_WEBHOOK_SECRET": "test_wh_secret",
                "EMAIL_KEY": "test_key",
                "OWNER_EMAIL": "info@bdsmarvel.com",
                "_with_booking_lock": AsyncMock(return_value="lock_123"),
                "_confirmed_overlap": AsyncMock(return_value=None),
                "send_email": AsyncMock(return_value=None),
                "_booking_email_html": lambda b: "html",
                "_guest_booking_email_html": lambda b, url: "html",
                "urlparse": lambda u: SimpleNamespace(netloc=""),
            },
        )
        self.payload = Record(
            stay_slug="living-studio", check_in="2099-05-10", check_out="2099-05-15",
            adults=2, children=0, infants=0, pets=0, name="Jane Doe",
            email="jane@example.com", phone="+919876543210", message="Test booking",
        )

    def test_payment_order_unpaid_when_no_razorpay_keys(self):
        result = asyncio.run(self.ns["create_stay_payment_order"](
            self.payload, SimpleNamespace(headers={}), {"user_id": "user_456"}
        ))
        self.assertFalse(result["payment_required"])
        bk = result["booking"]
        self.assertEqual(bk["stay"], "The Living Studio")
        self.assertEqual(bk["status"], "requested")
        self.assertEqual(bk["payment_status"], "not_required")
        self.assertEqual(bk["total"], 28000 * 5)
        self.db.bookings.insert_one.assert_awaited_once()

    def test_payment_order_rejects_exceeding_capacity(self):
        self.payload.adults = 10
        with self.assertRaises(HTTPError) as err:
            asyncio.run(self.ns["create_stay_payment_order"](
                self.payload, SimpleNamespace(headers={}), {"user_id": "user_456"}
            ))
        self.assertEqual(err.exception.status_code, 422)

    def test_payment_verify_validates_hmac_signature(self):
        self.ns["RAZORPAY_KEY_ID"] = "rzp_test_123"
        self.ns["RAZORPAY_KEY_SECRET"] = "secret_key_abc"

        order_id = "order_999"
        payment_id = "pay_888"
        forged_sig = "0" * 64

        self.db.bookings.find_one = AsyncMock(return_value={
            "id": "book_1",
            "user_id": "user_456",
            "razorpay_order_id": order_id,
            "payment_provider": "razorpay",
            "total": 50000,
            "stay_slug": "living-studio",
            "stay": "The Living Studio",
            "check_in": "2099-05-10",
            "check_out": "2099-05-15",
        })

        verify_payload = Record(
            booking_id="book_1",
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            razorpay_signature=forged_sig,
        )

        with self.assertRaises(HTTPError) as err:
            asyncio.run(self.ns["verify_stay_payment"](
                verify_payload, SimpleNamespace(headers={}), {"user_id": "user_456"}
            ))
        self.assertEqual(err.exception.status_code, 400)
        self.assertIn("signature", err.exception.detail)

    def test_public_config_reports_status(self):
        cfg = asyncio.run(self.ns["public_config"]())
        self.assertEqual(cfg["brand_name"], "BDS Marvel")
        self.assertFalse(cfg["payments_enabled"])

        self.ns["RAZORPAY_KEY_ID"] = "rzp_test"
        self.ns["RAZORPAY_KEY_SECRET"] = "rzp_sec"
        cfg_with_keys = asyncio.run(self.ns["public_config"]())
        self.assertTrue(cfg_with_keys["payments_enabled"])

    def test_razorpay_webhook_captures_payment(self):
        body_dict = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test123",
                        "order_id": "order_test123",
                    }
                }
            }
        }
        raw_body = json.dumps(body_dict).encode("utf-8")
        sig = hmac.new("test_wh_secret".encode(), raw_body, hashlib.sha256).hexdigest()

        self.db.bookings.find_one = AsyncMock(return_value={
            "id": "bk_999",
            "stay_slug": "living-studio",
            "stay": "The Living Studio",
            "check_in": "2099-05-10",
            "check_out": "2099-05-15",
            "mode": "instant",
            "payment_status": "pending",
        })

        req = SimpleNamespace(
            body=AsyncMock(return_value=raw_body),
            headers={"X-Razorpay-Signature": sig},
        )

        res = asyncio.run(self.ns["razorpay_webhook"](req))
        self.assertEqual(res, {"status": "ok"})
        self.db.bookings.update_one.assert_awaited()

    def test_admin_refund_booking_offline_fallback(self):
        self.db.bookings.find_one = AsyncMock(return_value={
            "id": "bk_paid_1",
            "total": 56000,
            "stay": "The Living Studio",
            "reference": "BDS-XYZ123",
            "email": "guest@example.com",
            "payment_status": "paid",
            "payment_id": "pay_test_999",
        })
        payload = Record(reason="Customer requested date shift", amount=None)
        req = SimpleNamespace(headers={})
        admin = {"user_id": "adm_1", "email": "admin@bdsmarvel.com"}

        result = asyncio.run(self.ns["admin_refund_booking"]("bk_paid_1", payload, admin, req))
        self.assertIsNotNone(result)
        self.db.bookings.update_one.assert_awaited()
        update_call = self.db.bookings.update_one.await_args[0][1]["$set"]
        self.assertEqual(update_call["payment_status"], "refunded")
        self.assertEqual(update_call["status"], "cancelled")
        self.assertEqual(update_call["refund_amount"], 56000)

    def test_razorpay_webhook_handles_refund_processed(self):
        body_dict = {
            "event": "refund.processed",
            "payload": {
                "refund": {
                    "entity": {
                        "id": "rfnd_abc123",
                        "payment_id": "pay_test_999",
                    }
                }
            }
        }
        raw_body = json.dumps(body_dict).encode("utf-8")
        sig = hmac.new("test_wh_secret".encode(), raw_body, hashlib.sha256).hexdigest()

        req = SimpleNamespace(
            body=AsyncMock(return_value=raw_body),
            headers={"X-Razorpay-Signature": sig},
        )

        res = asyncio.run(self.ns["razorpay_webhook"](req))
        self.assertEqual(res, {"status": "ok"})
        self.db.bookings.update_one.assert_awaited()


if __name__ == "__main__":
    unittest.main()
