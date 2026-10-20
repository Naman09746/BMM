"""Offline security tests for Admin 2FA (TOTP) and Audit Logging."""
import ast
import asyncio
import base64
import json
import os
from pathlib import Path
import time
from types import SimpleNamespace
import unittest
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


class AdminSecurityMfaTests(unittest.TestCase):
    def setUp(self):
        self.db = SimpleNamespace(
            users=SimpleNamespace(
                find_one=AsyncMock(),
                update_one=AsyncMock(),
                insert_one=AsyncMock(),
                delete_many=AsyncMock(),
            ),
            login_attempts=SimpleNamespace(
                find_one=AsyncMock(return_value=None),
                update_one=AsyncMock(),
                delete_one=AsyncMock(),
                delete_many=AsyncMock(),
            ),
            audit_logs=SimpleNamespace(
                insert_one=AsyncMock(),
                find=None,
            ),
        )
        self.test_secret = "JBSWY3DPEHPK3PXP"
        self.ns = load_functions(
            {"generate_totp", "verify_totp", "login", "verify_mfa", "admin_2fa_status",
             "admin_2fa_setup", "admin_2fa_enable", "admin_2fa_disable", "log_admin_action"},
            {
                "db": self.db,
                "HTTPException": HTTPError,
                "Request": object,
                "Response": object,
                "Depends": lambda value: None,
                "require_admin": None,
                "rate_limit": lambda *a, **kw: None,
                "UserOut": Record,
                "LoginIn": Record,
                "MfaVerifyIn": Record,
                "MfaSetupIn": Record,
                "timedelta": __import__("datetime").timedelta,
                "datetime": __import__("datetime").datetime,
                "timezone": __import__("datetime").timezone,
                "jwt": __import__("jwt"),
                "JWT_SECRET": "test-secret-key-32-bytes-long-12345",
                "JWT_ALGORITHM": "HS256",
                "_jwt": lambda user_id, kind, delta: __import__("jwt").encode(
                    {"sub": user_id, "type": kind, "exp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc) + delta},
                    "test-secret-key-32-bytes-long-12345", algorithm="HS256"
                ),
                "_issue_jwt": lambda resp, uid: None,
                "_client_ip": lambda req: "127.0.0.1",
                "_alert_new_admin_device": AsyncMock(),
                "verify_password": lambda plain, hashed: plain == "correct-password",
                "logger": SimpleNamespace(info=lambda *a: None, warning=lambda *a: None, error=lambda *a: None),
                "os": os,
                "re": __import__("re"),
                "uuid": __import__("uuid"),
                "base64": base64,
                "struct": __import__("struct"),
                "time": time,
                "hmac": __import__("hmac"),
                "hashlib": __import__("hashlib"),
                "secrets": __import__("secrets"),
            }
        )

    def test_totp_rfc6238_generation_and_verification(self):
        gen = self.ns["generate_totp"]
        verify = self.ns["verify_totp"]

        code = gen(self.test_secret)
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())
        self.assertTrue(verify(self.test_secret, code))

        # Reject bogus code
        wrong_code = "000000" if code != "000000" else "111111"
        self.assertFalse(verify(self.test_secret, wrong_code))

        # Reject empty or malformed code
        self.assertFalse(verify(self.test_secret, ""))
        self.assertFalse(verify(self.test_secret, "abc"))
        self.assertFalse(verify(self.test_secret, "12345"))

    def test_admin_login_requires_mfa_when_enabled(self):
        admin_user = {
            "user_id": "usr_admin_123",
            "email": "owner@bdsmarvel.com",
            "name": "BDS Owner",
            "password_hash": "hashed-val",
            "role": "admin",
            "totp_enabled": True,
            "totp_secret": self.test_secret,
        }
        self.db.users.find_one = AsyncMock(return_value=admin_user)

        payload = Record(
            email="owner@bdsmarvel.com",
            password="correct-password",
            totp_code=None,
            mfa_token=None,
        )
        req = SimpleNamespace(headers={})
        resp = SimpleNamespace()

        # Call login without totp_code
        result = asyncio.run(self.ns["login"](payload, req, resp))
        self.assertTrue(result.mfa_required)
        self.assertIsNotNone(result.mfa_token)
        self.assertEqual(result.email, "owner@bdsmarvel.com")

    def test_verify_mfa_accepts_valid_code(self):
        admin_user = {
            "user_id": "usr_admin_123",
            "email": "owner@bdsmarvel.com",
            "name": "BDS Owner",
            "role": "admin",
            "totp_enabled": True,
            "totp_secret": self.test_secret,
        }
        self.db.users.find_one = AsyncMock(return_value=admin_user)

        valid_code = self.ns["generate_totp"](self.test_secret)
        mfa_token = self.ns["_jwt"]("usr_admin_123", "mfa_pending", __import__("datetime").timedelta(minutes=5))

        payload = Record(mfa_token=mfa_token, totp_code=valid_code)
        req = SimpleNamespace(headers={})
        resp = SimpleNamespace()

        result = asyncio.run(self.ns["verify_mfa"](payload, req, resp))
        self.assertEqual(result.user_id, "usr_admin_123")
        self.assertEqual(result.role, "admin")
        self.db.audit_logs.insert_one.assert_awaited()

    def test_verify_mfa_rejects_invalid_code(self):
        admin_user = {
            "user_id": "usr_admin_123",
            "email": "owner@bdsmarvel.com",
            "name": "BDS Owner",
            "role": "admin",
            "totp_enabled": True,
            "totp_secret": self.test_secret,
        }
        self.db.users.find_one = AsyncMock(return_value=admin_user)

        mfa_token = self.ns["_jwt"]("usr_admin_123", "mfa_pending", __import__("datetime").timedelta(minutes=5))
        payload = Record(mfa_token=mfa_token, totp_code="999999")
        req = SimpleNamespace(headers={})
        resp = SimpleNamespace()

        with self.assertRaises(HTTPError) as ctx:
            asyncio.run(self.ns["verify_mfa"](payload, req, resp))
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid two-factor", ctx.exception.detail)

    def test_verify_mfa_locks_out_after_repeated_failures(self):
        admin_user = {
            "user_id": "usr_admin_123",
            "email": "owner@bdsmarvel.com",
            "name": "BDS Owner",
            "role": "admin",
            "totp_enabled": True,
            "totp_secret": self.test_secret,
        }
        self.db.users.find_one = AsyncMock(return_value=admin_user)
        # Mock that this identifier is currently locked out
        future_lock = (__import__("datetime").datetime.now(__import__("datetime").timezone.utc) + __import__("datetime").timedelta(minutes=10)).isoformat()
        self.db.login_attempts.find_one = AsyncMock(return_value={"identifier": "127.0.0.1:owner@bdsmarvel.com", "locked_until": future_lock})

        mfa_token = self.ns["_jwt"]("usr_admin_123", "mfa_pending", __import__("datetime").timedelta(minutes=5))
        payload = Record(mfa_token=mfa_token, totp_code="123456")
        req = SimpleNamespace(headers={})
        resp = SimpleNamespace()

        with self.assertRaises(HTTPError) as ctx:
            asyncio.run(self.ns["verify_mfa"](payload, req, resp))
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Too many attempts", ctx.exception.detail)

    def test_audit_logging_persists_details(self):
        admin = {"user_id": "usr_admin_123", "email": "owner@bdsmarvel.com"}
        req = SimpleNamespace(headers={"user-agent": "Safari on macOS"})

        asyncio.run(self.ns["log_admin_action"](
            admin, "test_action", "stay:test-stay", {"foo": "bar"}, req
        ))
        self.db.audit_logs.insert_one.assert_awaited()
        call_args = self.db.audit_logs.insert_one.await_args[0][0]
        self.assertEqual(call_args["action"], "test_action")
        self.assertEqual(call_args["target"], "stay:test-stay")
        self.assertEqual(call_args["admin_email"], "owner@bdsmarvel.com")
        self.assertEqual(call_args["ip"], "127.0.0.1")

    def test_footer_owner_link_is_removed(self):
        app_js = (ROOT / "frontend/src/App.js").read_text()
        self.assertNotIn("footer-link-owner", app_js)

    def test_admin_gate_modal_shortcut_is_wired(self):
        app_js = (ROOT / "frontend/src/App.js").read_text()
        self.assertIn("AdminGateModal", app_js)
        self.assertIn("admin-gate-modal", app_js)
        self.assertIn("isShiftA", app_js)


if __name__ == "__main__":
    unittest.main()
