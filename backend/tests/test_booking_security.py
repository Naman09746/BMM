"""Offline security regressions. Run from the repository root:

python3 -m unittest discover -s backend/tests -p test_booking_security.py -v
"""
import ast
import asyncio
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend/server.py"


def load_functions(names, namespace):
    """Exercise actual server functions without importing Mongo or loading secrets."""
    nodes = [
        node for node in ast.parse(SERVER.read_text()).body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names
    ]
    for node in nodes:
        node.decorator_list = []
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SERVER), "exec"), namespace)
    return namespace


class ClientIPTests(unittest.TestCase):
    def setUp(self):
        self.ns = load_functions(
            {"_client_ip", "_is_trusted_proxy"},
            {"ipaddress": ipaddress, "Request": object,
             "TRUSTED_PROXY_NETWORKS": (ipaddress.ip_network("10.0.0.0/8"),)},
        )

    def ip(self, peer, forwarded):
        request = SimpleNamespace(
            client=SimpleNamespace(host=peer),
            headers={"x-forwarded-for": forwarded},
        )
        return self.ns["_client_ip"](request)

    def test_direct_client_cannot_spoof_forwarded_address(self):
        self.assertEqual(self.ip("198.51.100.5", "1.2.3.4"), "198.51.100.5")

    def test_trusted_proxy_ignores_forged_prefix(self):
        self.assertEqual(self.ip("10.0.0.9", "1.2.3.4, 203.0.113.7"), "203.0.113.7")

    def test_multiple_trusted_proxies(self):
        self.assertEqual(self.ip("10.0.0.9", "1.2.3.4, 203.0.113.7, 10.0.0.8"), "203.0.113.7")

    def test_no_configured_proxy_uses_socket(self):
        self.ns["TRUSTED_PROXY_NETWORKS"] = ()
        self.assertEqual(self.ip("10.0.0.9", "1.2.3.4"), "10.0.0.9")


class HTTPError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code


class Record(SimpleNamespace):
    def model_dump(self):
        return vars(self).copy()


class BookingTests(unittest.TestCase):
    def setUp(self):
        from datetime import datetime, timezone
        import secrets
        import uuid

        self.db = SimpleNamespace(
            bookings=SimpleNamespace(insert_one=AsyncMock()),
            booking_locks=SimpleNamespace(delete_one=AsyncMock()),
            stays=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        )
        self.ns = load_functions(
            {"create_stay_booking"},
            {"StayBookingCreate": Record, "StayBooking": Record, "Request": object,
             "Depends": lambda value: None, "get_current_user": None,
             "ROOT_DIR": ROOT / "backend", "json": json, "datetime": datetime,
             "timezone": timezone, "uuid": uuid, "secrets": secrets, "db": self.db,
             "HTTPException": HTTPError, "logger": SimpleNamespace(info=lambda *a: None, error=lambda *a: None),
             "_with_booking_lock": AsyncMock(return_value="lock"),
             "_confirmed_overlap": AsyncMock(return_value=None)},
        )
        self.payload = Record(
            stay_slug="living-studio", check_in="2099-01-01", check_out="2099-01-03",
            adults=2, children=0, infants=0, pets=0, name="Test",
            email="test@example.com", phone="12345678", message=None,
        )

    def book(self):
        return asyncio.run(self.ns["create_stay_booking"](
            self.payload, SimpleNamespace(headers={}), {"user_id": "test-user"}
        ))

    def test_server_controls_price_name_and_confirmation(self):
        # Legacy fields must never override authoritative catalogue values.
        self.payload.nightly = 1
        self.payload.capacity = 16
        self.payload.stay = "Forged name"
        self.payload.mode = "instant"
        # The real input model ignores these extra fields before the handler.
        self.payload.model_dump = lambda: {
            k: v for k, v in vars(self.payload).items()
            if k not in {"nightly", "capacity", "stay", "mode", "model_dump"}
        }
        result = self.book()
        self.assertEqual((result.stay, result.nightly, result.total),
                         ("The Living Studio", 28000, 56000))
        self.assertEqual(result.status, "requested")
        self.db.bookings.insert_one.assert_awaited_once()

    def test_guest_capacity_comes_from_catalogue(self):
        self.payload.adults = 7
        with self.assertRaises(HTTPError) as error:
            self.book()
        self.assertEqual(error.exception.status_code, 422)
        self.db.bookings.insert_one.assert_not_awaited()

    def test_unknown_listing_rejected(self):
        self.payload.stay_slug = "unknown"
        with self.assertRaises(HTTPError) as error:
            self.book()
        self.assertEqual(error.exception.status_code, 404)
        self.db.bookings.insert_one.assert_not_awaited()


class CatalogueTests(unittest.TestCase):
    def test_backend_and_wordpress_catalogues_match(self):
        backend = json.loads((ROOT / "backend/stays.json").read_text())
        wordpress = json.loads((ROOT / "wordpress/bds-marvel-app/includes/stays.json").read_text())
        self.assertEqual(backend, wordpress)
        self.assertEqual(len(backend), len({stay["slug"] for stay in backend}))
        self.assertEqual(len(backend), 15)


class BuildTests(unittest.TestCase):
    def test_backend_url_required_before_build(self):
        for value in (None, ""):
            with self.subTest(value=value):
                env = os.environ.copy()
                env.pop("REACT_APP_BACKEND_URL", None)
                if value is not None:
                    env["REACT_APP_BACKEND_URL"] = value
                result = subprocess.run(
                    ["bash", str(ROOT / "scripts/build-wordpress.sh")],
                    env=env, capture_output=True, text=True,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Set REACT_APP_BACKEND_URL", result.stderr)


if __name__ == "__main__":
    unittest.main()
