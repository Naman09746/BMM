"""Explicit password rotation for the standalone FastAPI/MongoDB backend.

Run on the backend host with its production environment loaded:
    python backend/rotate_admin_password.py

This does not change WordPress accounts or the host's JWT_SECRET.
"""
import asyncio
import getpass
import os
from pathlib import Path


async def rotate(db, email, new_hash):
    """Change only the existing admin; reject a concurrent account change."""
    admin = await db.users.find_one({"email": email, "role": "admin"})
    if not admin:
        raise RuntimeError("No existing admin matches ADMIN_EMAIL; no account was changed.")
    if not admin.get("user_id"):
        raise RuntimeError("The admin account has no user_id; repair it before rotation.")
    result = await db.users.update_one(
        {"_id": admin["_id"], "role": "admin",
         "password_hash": admin.get("password_hash")},
        {"$set": {"password_hash": new_hash}},
    )
    if result.matched_count != 1:
        raise RuntimeError("The admin account changed concurrently; retry after checking it.")
    # Google/session authentication is independent of the password hash.
    # JWT access/refresh tokens require a separate JWT_SECRET rotation.
    await db.user_sessions.delete_many({"user_id": admin["user_id"]})


async def main():
    import bcrypt
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient

    load_dotenv(Path(__file__).parent / ".env")
    email = os.environ["ADMIN_EMAIL"].strip().lower()
    password = getpass.getpass("New admin password: ")
    if len(password) < 16 or len(password.encode("utf-8")) > 72:
        raise ValueError("Use at least 16 characters and at most 72 UTF-8 bytes.")
    if password != getpass.getpass("Confirm new admin password: "):
        raise ValueError("Passwords do not match.")
    new_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=10000)
    try:
        await rotate(client[os.environ["DB_NAME"]], email, new_hash)
    finally:
        client.close()
    print("Admin password changed and database sessions revoked.")
    print("Set ADMIN_PASSWORD to the same value in the host's secret settings.")
    print("Rotate JWT_SECRET there and restart every backend worker to revoke JWTs.")


if __name__ == "__main__":
    asyncio.run(main())
