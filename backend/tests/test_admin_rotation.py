"""Dependency-free tests for the explicit standalone admin rotation."""
import asyncio
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

spec = importlib.util.spec_from_file_location(
    "rotate_admin_password", Path(__file__).resolve().parents[1] / "rotate_admin_password.py"
)
rotation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rotation)


class AdminRotationTests(unittest.TestCase):
    def db(self, admin=None, matched=1):
        return SimpleNamespace(
            users=SimpleNamespace(
                find_one=AsyncMock(return_value=admin),
                update_one=AsyncMock(return_value=SimpleNamespace(matched_count=matched)),
            ),
            user_sessions=SimpleNamespace(delete_many=AsyncMock()),
        )

    def test_rotates_existing_admin_and_revokes_its_sessions(self):
        db = self.db({"_id": "a", "user_id": "admin-user", "password_hash": "old-hash"})
        asyncio.run(rotation.rotate(db, "admin@example.com", "new-hash"))
        db.users.update_one.assert_awaited_once_with(
            {"_id": "a", "role": "admin", "password_hash": "old-hash"},
            {"$set": {"password_hash": "new-hash"}},
        )
        db.user_sessions.delete_many.assert_awaited_once_with({"user_id": "admin-user"})

    def test_missing_admin_does_not_create_or_promote_accounts(self):
        db = self.db()
        with self.assertRaises(RuntimeError):
            asyncio.run(rotation.rotate(db, "missing@example.com", "new-hash"))
        db.users.update_one.assert_not_awaited()
        db.user_sessions.delete_many.assert_not_awaited()

    def test_concurrent_change_stops_before_revoking_sessions(self):
        db = self.db({"_id": "a", "user_id": "admin-user", "password_hash": "old-hash"}, matched=0)
        with self.assertRaises(RuntimeError):
            asyncio.run(rotation.rotate(db, "admin@example.com", "new-hash"))
        db.user_sessions.delete_many.assert_not_awaited()

    def test_malformed_admin_is_rejected_before_updating_password(self):
        db = self.db({"_id": "a", "password_hash": "old-hash"})
        with self.assertRaises(RuntimeError):
            asyncio.run(rotation.rotate(db, "admin@example.com", "new-hash"))
        db.users.update_one.assert_not_awaited()
        db.user_sessions.delete_many.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
