"""Offline tests for Admin Dashboards (Catalogue Inventory & Airbnb Stays)."""
import ast
import asyncio
import json
import re
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

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


from datetime import datetime, timezone
import logging
from typing import Optional, List, Literal

logger = logging.getLogger(__name__)


class AdminDashboardsTests(unittest.TestCase):
    def setUp(self):
        self.db = SimpleNamespace(
            catalogue=SimpleNamespace(
                find=None,
                find_one=AsyncMock(),
                insert_one=AsyncMock(),
                update_one=AsyncMock(),
                delete_one=AsyncMock(),
            ),
            stays=SimpleNamespace(
                find=None,
                find_one=AsyncMock(),
                insert_one=AsyncMock(),
                update_one=AsyncMock(),
                delete_one=AsyncMock(),
            ),
        )
        self.ns = load_functions(
            {
                "_slugify",
                "list_catalogue",
                "get_catalogue_item",
                "admin_create_catalogue_item",
                "admin_update_catalogue_item",
                "admin_delete_catalogue_item",
                "list_stays",
                "get_stay",
                "admin_create_stay",
                "admin_update_stay",
                "admin_delete_stay",
                "get_media_file",
            },
            {
                "HTTPException": HTTPError,
                "db": self.db,
                "re": re,
                "json": json,
                "uuid": uuid,
                "datetime": datetime,
                "timezone": timezone,
                "Depends": lambda x=None: None,
                "require_admin": None,
                "File": lambda *a, **k: None,
                "UploadFile": None,
                "Request": object,
                "log_admin_action": AsyncMock(),
                "CatalogueItemIn": Record,
                "StayIn": Record,
                "Optional": Optional,
                "List": List,
                "Literal": Literal,
                "logger": logger,
                "ROOT_DIR": ROOT / "backend",
                "APP_NAME": "bdsmarvel",
                "UPLOAD_DIR": ROOT / "backend/uploads",
                "_MIME_TYPES": {
                    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                    "webp": "image/webp", "gif": "image/gif",
                },
                "Response": lambda content, media_type, headers=None: SimpleNamespace(content=content, media_type=media_type, headers=headers),
            },
        )

    def test_slugify_helper(self):
        _slugify = self.ns["_slugify"]
        self.assertEqual(_slugify("Centre & End Tables"), "centre-end-tables")
        self.assertEqual(_slugify("The 100% Pure Italian Marble!"), "the-100-pure-italian-marble")
        self.assertTrue(len(_slugify("")) > 0)

    def test_admin_create_catalogue_item(self):
        _slugify = self.ns["_slugify"]
        admin_create = self.ns["admin_create_catalogue_item"]

        self.db.catalogue.find_one.side_effect = [
            None,  # slug check
            {"id": "test-123", "slug": "black-marble-table", "name": "Black Marble Table", "brand": "DrawStones"},
        ]

        payload = Record(
            name="Black Marble Table",
            slug=None,
            brand="DrawStones",
            category="Marble & Stone",
            material="Marble",
            product="Tables",
            application="Living",
            origin="Black marble",
            image="photo-12345",
            desc="Exquisite handcrafted table.",
            specs=[["Material", "Black marble"]],
            gallery=["photo-12345"],
            is_active=True,
        )

        res = asyncio.run(admin_create(payload, _={"role": "admin"}))
        self.assertEqual(res["slug"], "black-marble-table")
        self.assertEqual(res["name"], "Black Marble Table")
        self.db.catalogue.insert_one.assert_called_once()

    def test_admin_update_catalogue_item(self):
        admin_update = self.ns["admin_update_catalogue_item"]

        self.db.catalogue.find_one.side_effect = [
            {"id": "item-1", "slug": "old-slug", "name": "Old Name"},  # target lookup
            None,  # clash check
            {"id": "item-1", "slug": "new-slug", "name": "Updated Table"},  # after update
        ]

        payload = Record(
            name="Updated Table",
            slug="new-slug",
            brand="DrawStones",
            category="Marble & Stone",
            material="Marble",
            product="Tables",
            application="Living",
            origin="Rajasthan",
            image="photo-updated",
            desc="Updated description",
            specs=[["Material", "White marble"]],
            gallery=[],
            is_active=True,
        )

        res = asyncio.run(admin_update("item-1", payload, _={"role": "admin"}))
        self.assertEqual(res["name"], "Updated Table")
        self.db.catalogue.update_one.assert_called_once()

    def test_admin_delete_catalogue_item(self):
        admin_delete = self.ns["admin_delete_catalogue_item"]
        self.db.catalogue.find_one.return_value = {"id": "item-to-delete", "slug": "delete-me"}

        res = asyncio.run(admin_delete("item-to-delete", _={"role": "admin"}))
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["deleted_id"], "item-to-delete")
        self.db.catalogue.delete_one.assert_called_once_with({"id": "item-to-delete"})

    def test_admin_create_stay(self):
        admin_create_stay = self.ns["admin_create_stay"]

        self.db.stays.find_one.side_effect = [
            None,  # slug check
            {"id": "stay-123", "slug": "haveli-suite", "name": "The Haveli Suite", "price": "₹25,000", "nightly": 25000, "tier": "Premium"},
        ]

        payload = Record(
            name="The Haveli Suite",
            slug=None,
            tier="Premium",
            location="Jaipur, Rajasthan",
            city="Jaipur",
            state="Rajasthan",
            nightly=25000,
            guests=4,
            bedrooms=2,
            beds=2,
            baths=2,
            type="Villa",
            lat=26.9124,
            lng=75.7873,
            hero="photo-hero",
            gallery=["photo-1", "photo-2"],
            blurb="Historic courtyard haveli.",
            description="Restored royal haveli with handcrafted marble flooring and jali screens.",
            amenities=["Private pool", "Butler service", "Workshop tour"],
            rules=["No smoking indoors"],
            booking_mode="instant",
            min_nights=2,
            is_active=True,
        )

        res = asyncio.run(admin_create_stay(payload, _={"role": "admin"}))
        self.assertEqual(res["slug"], "haveli-suite")
        self.assertEqual(res["price"], "₹25,000")
        self.db.stays.insert_one.assert_called_once()

    def test_admin_update_stay(self):
        admin_update_stay = self.ns["admin_update_stay"]

        self.db.stays.find_one.side_effect = [
            {"id": "stay-1", "slug": "living-studio", "name": "The Living Studio"},
            {"id": "stay-1", "slug": "living-studio", "name": "The Living Studio", "nightly": 30000, "price": "₹30,000"},
        ]

        payload = Record(
            name="The Living Studio",
            slug="living-studio",
            tier="Premium",
            location="Alibaug, Maharashtra",
            city="Alibaug",
            state="Maharashtra",
            nightly=30000,
            guests=6,
            bedrooms=3,
            beds=3,
            baths=3,
            type="Villa",
            lat=18.6414,
            lng=72.8722,
            hero="photo-hero",
            gallery=[],
            blurb="Updated blurb",
            description="Updated description",
            amenities=["All amenities"],
            rules=[],
            booking_mode="instant",
            min_nights=1,
            is_active=True,
        )

        res = asyncio.run(admin_update_stay("living-studio", payload, _={"role": "admin"}))
        self.assertEqual(res["nightly"], 30000)
        self.assertEqual(res["price"], "₹30,000")
        self.db.stays.update_one.assert_called_once()

    def test_media_file_traversal_blocked(self):
        get_media = self.ns["get_media_file"]
        with self.assertRaises(HTTPError) as ctx:
            asyncio.run(get_media("../secret.txt"))
        self.assertEqual(ctx.exception.status_code, 400)

        with self.assertRaises(HTTPError) as ctx:
            asyncio.run(get_media("sub/dir/img.png"))
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
