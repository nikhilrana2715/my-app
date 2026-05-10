from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import json
import logging
import asyncio
import bcrypt
import jwt as pyjwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form, Header, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response as FResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("aasha")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
APP_NAME = os.environ.get('APP_NAME', 'aasha')
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set; storage disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    r = requests.get(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------- App ----------
app = FastAPI(title="Aasha API")
api = APIRouter(prefix="/api")

# ---------- Helpers ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(p: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, email: str, days: int = 30) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=days),
               "iat": datetime.now(timezone.utc)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> Optional[dict]:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None

async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def user_from_token(token: str) -> Optional[dict]:
    payload = decode_token(token)
    if not payload:
        return None
    return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def public_user(u: dict) -> dict:
    if not u:
        return {}
    return {"id": u["id"], "name": u.get("name", ""), "email": u.get("email", ""),
            "phone": u.get("phone"), "avatar": u.get("avatar"), "bio": u.get("bio", ""),
            "online": u.get("online", False), "last_seen": u.get("last_seen")}

# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class OtpSendIn(BaseModel):
    phone: str

class OtpVerifyIn(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None

class GoogleSessionIn(BaseModel):
    session_id: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None

class CreateConvIn(BaseModel):
    member_ids: List[str]
    is_group: bool = False
    name: Optional[str] = None
    avatar: Optional[str] = None

class SendMessageIn(BaseModel):
    conversation_id: str
    type: str = "text"  # text, image, video, audio, file, location, link
    text: Optional[str] = None
    file_id: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    reply_to: Optional[str] = None
    forwarded_from: Optional[str] = None

class ForwardIn(BaseModel):
    message_id: str
    conversation_ids: List[str]

# ---------- Auth ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {"id": uid, "name": body.name.strip(), "email": email,
           "password_hash": hash_password(body.password),
           "phone": None, "avatar": None, "bio": "Hey there! I'm using Aasha 🌅",
           "online": False, "last_seen": now_iso(),
           "created_at": now_iso(), "auth_provider": "email"}
    await db.users.insert_one(doc)
    token = create_token(uid, email)
    return {"token": token, "user": public_user(doc)}

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], email)
    return {"token": token, "user": public_user(user)}

@api.post("/auth/otp/send")
async def otp_send(body: OtpSendIn):
    # Mock OTP: any 6-digit code accepted; we return a hint
    phone = body.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone required")
    return {"sent": True, "hint": "Mock OTP — enter any 6-digit code (e.g., 123456)"}

@api.post("/auth/otp/verify")
async def otp_verify(body: OtpVerifyIn):
    if not body.otp or len(body.otp) != 6 or not body.otp.isdigit():
        raise HTTPException(status_code=400, detail="OTP must be 6 digits")
    phone = body.phone.strip()
    user = await db.users.find_one({"phone": phone})
    if not user:
        uid = str(uuid.uuid4())
        name = (body.name or f"User {phone[-4:]}").strip()
        # Use phone-based pseudo email to satisfy unique email index
        email = f"{phone.replace('+','').replace(' ','')}@phone.aasha.local"
        doc = {"id": uid, "name": name, "email": email, "phone": phone,
               "avatar": None, "bio": "Hey there! I'm using Aasha 🌅",
               "online": False, "last_seen": now_iso(),
               "created_at": now_iso(), "auth_provider": "phone"}
        await db.users.insert_one(doc)
        user = doc
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": public_user(user)}

@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn):
    """Exchange session_id from Emergent Google Auth for our JWT."""
    try:
        r = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                         headers={"X-Session-ID": body.session_id}, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Google session exchange failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid session_id")
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="No email returned")
    user = await db.users.find_one({"email": email})
    if not user:
        uid = str(uuid.uuid4())
        doc = {"id": uid, "name": data.get("name") or email.split("@")[0],
               "email": email, "phone": None,
               "avatar": data.get("picture"),
               "bio": "Hey there! I'm using Aasha 🌅",
               "online": False, "last_seen": now_iso(),
               "created_at": now_iso(), "auth_provider": "google"}
        await db.users.insert_one(doc)
        user = doc
    token = create_token(user["id"], email)
    return {"token": token, "user": public_user(user)}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)

@api.post("/auth/logout")
async def logout(user=Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"online": False, "last_seen": now_iso()}})
    return {"ok": True}

@api.patch("/auth/profile")
async def update_profile(body: ProfileUpdate, user=Depends(current_user)):
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return public_user(fresh)

# ---------- Users ----------
@api.get("/users/search")
async def search_users(q: str = "", user=Depends(current_user)):
    q = q.strip()
    query: Dict[str, Any] = {"id": {"$ne": user["id"]}}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).limit(50).to_list(50)
    return [public_user(u) for u in users]

@api.get("/users/{user_id}")
async def get_user(user_id: str, user=Depends(current_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(u)

# ---------- Files ----------
@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    ext = (file.filename or "bin").split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, data, content_type)
    doc = {"id": file_id, "storage_path": result["path"],
           "original_filename": file.filename or f"file.{ext}",
           "content_type": content_type, "size": result.get("size", len(data)),
           "uploaded_by": user["id"], "is_deleted": False,
           "created_at": now_iso()}
    await db.files.insert_one(doc)
    return {"id": file_id, "name": doc["original_filename"], "size": doc["size"],
            "content_type": content_type, "url": f"/api/files/{file_id}"}

@api.get("/files/{file_id}")
async def download_file(file_id: str, auth: Optional[str] = Query(None),
                         authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token or not decode_token(token):
        raise HTTPException(status_code=401, detail="Auth required")
    record = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(record["storage_path"])
    return FResponse(content=data, media_type=record.get("content_type", ct),
                     headers={"Content-Disposition": f'inline; filename="{record["original_filename"]}"'})

# ---------- Conversations ----------
async def ensure_dm(user_a: str, user_b: str) -> dict:
    members = sorted([user_a, user_b])
    existing = await db.conversations.find_one({"is_group": False, "members": members}, {"_id": 0})
    if existing:
        return existing
    cid = str(uuid.uuid4())
    doc = {"id": cid, "is_group": False, "members": members, "name": None, "avatar": None,
           "admins": [], "created_by": user_a, "created_at": now_iso(),
           "last_message": None, "last_message_at": now_iso()}
    await db.conversations.insert_one(doc)
    return doc

async def hydrate_conv(conv: dict, current_uid: str,
                       users_by_id: Optional[Dict[str, dict]] = None,
                       unread_by_cid: Optional[Dict[str, int]] = None) -> dict:
    out = {**conv}
    out.pop("_id", None)
    if not conv["is_group"]:
        other_id = next((m for m in conv["members"] if m != current_uid), None)
        if other_id:
            other = (users_by_id.get(other_id) if users_by_id is not None
                     else await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0}))
            if other:
                out["name"] = other["name"]
                out["avatar"] = other.get("avatar")
                out["other_user"] = public_user(other)
    # Get member previews (for groups)
    if conv["is_group"]:
        if users_by_id is not None:
            ms = [users_by_id[m] for m in conv["members"] if m in users_by_id]
        else:
            ms = await db.users.find({"id": {"$in": conv["members"]}}, {"_id": 0, "password_hash": 0}).to_list(100)
        out["member_users"] = [public_user(m) for m in ms]
    # Unread count
    if unread_by_cid is not None:
        out["unread"] = unread_by_cid.get(conv["id"], 0)
    else:
        out["unread"] = await db.messages.count_documents({
            "conversation_id": conv["id"],
            "sender_id": {"$ne": current_uid},
            "read_by": {"$ne": current_uid}
        })
    return out

@api.get("/conversations")
async def list_conversations(user=Depends(current_user)):
    convs = await db.conversations.find({"members": user["id"]}, {"_id": 0}).sort("last_message_at", -1).to_list(200)
    if not convs:
        return []
    # Batch: collect all member ids across all conversations
    all_member_ids = {m for c in convs for m in c.get("members", [])}
    users_list = await db.users.find({"id": {"$in": list(all_member_ids)}},
                                      {"_id": 0, "password_hash": 0}).to_list(len(all_member_ids))
    users_by_id = {u["id"]: u for u in users_list}
    # Batch: aggregate unread counts per conversation in one query
    cids = [c["id"] for c in convs]
    pipeline = [
        {"$match": {
            "conversation_id": {"$in": cids},
            "sender_id": {"$ne": user["id"]},
            "read_by": {"$ne": user["id"]},
            "deleted": {"$ne": True},
        }},
        {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
    ]
    unread_by_cid: Dict[str, int] = {}
    async for row in db.messages.aggregate(pipeline):
        unread_by_cid[row["_id"]] = row["count"]
    return [await hydrate_conv(c, user["id"], users_by_id, unread_by_cid) for c in convs]

@api.post("/conversations")
async def create_conversation(body: CreateConvIn, user=Depends(current_user)):
    members = list(set(body.member_ids + [user["id"]]))
    if len(members) < 2:
        raise HTTPException(status_code=400, detail="Need at least one other member")
    if not body.is_group and len(members) == 2:
        conv = await ensure_dm(members[0], members[1])
        return await hydrate_conv(conv, user["id"])
    cid = str(uuid.uuid4())
    doc = {"id": cid, "is_group": True,
           "members": sorted(members),
           "name": body.name or "New Group",
           "avatar": body.avatar,
           "admins": [user["id"]], "created_by": user["id"],
           "created_at": now_iso(), "last_message": None, "last_message_at": now_iso()}
    await db.conversations.insert_one(doc)
    return await hydrate_conv(doc, user["id"])

@api.get("/conversations/{cid}")
async def get_conversation(cid: str, user=Depends(current_user)):
    conv = await db.conversations.find_one({"id": cid, "members": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    return await hydrate_conv(conv, user["id"])

# ---------- Messages ----------
async def hydrate_message(msg: dict, files_by_id: Optional[Dict[str, dict]] = None) -> dict:
    out = {k: v for k, v in msg.items() if k != "_id"}
    fid = msg.get("file_id")
    if fid:
        f = (files_by_id.get(fid) if files_by_id is not None
             else await db.files.find_one({"id": fid}, {"_id": 0}))
        if f:
            out["file"] = {"id": f["id"], "name": f["original_filename"],
                           "size": f["size"], "content_type": f["content_type"],
                           "url": f"/api/files/{f['id']}"}
    return out

@api.get("/conversations/{cid}/messages")
async def list_messages(cid: str, before: Optional[str] = None, limit: int = 50, user=Depends(current_user)):
    conv = await db.conversations.find_one({"id": cid, "members": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    q: Dict[str, Any] = {"conversation_id": cid, "deleted": {"$ne": True}}
    if before:
        q["created_at"] = {"$lt": before}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 100)).to_list(limit)
    msgs.reverse()
    # Mark as read
    upd = await db.messages.update_many(
        {"conversation_id": cid, "sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]}},
        {"$addToSet": {"read_by": user["id"]}}
    )
    if upd.modified_count > 0:
        await broadcast_to_members(conv["members"], {
            "type": "read", "conversation_id": cid, "user_id": user["id"],
        })
    # Batch: fetch all referenced files in one query
    file_ids = [m["file_id"] for m in msgs if m.get("file_id")]
    files_by_id: Dict[str, dict] = {}
    if file_ids:
        async for f in db.files.find({"id": {"$in": list(set(file_ids))}}, {"_id": 0}):
            files_by_id[f["id"]] = f
    return [await hydrate_message(m, files_by_id) for m in msgs]

async def _create_and_broadcast_message(payload: dict, sender: dict) -> dict:
    cid = payload["conversation_id"]
    conv = await db.conversations.find_one({"id": cid, "members": sender["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    mid = str(uuid.uuid4())
    msg = {"id": mid, "conversation_id": cid, "sender_id": sender["id"],
           "sender_name": sender["name"], "sender_avatar": sender.get("avatar"),
           "type": payload.get("type", "text"),
           "text": payload.get("text"),
           "file_id": payload.get("file_id"),
           "location": payload.get("location"),
           "reply_to": payload.get("reply_to"),
           "forwarded_from": payload.get("forwarded_from"),
           "read_by": [sender["id"]],
           "deleted": False,
           "created_at": now_iso()}
    await db.messages.insert_one(msg)
    last = msg.get("text") or {"image": "📷 Photo", "video": "🎬 Video", "audio": "🎙 Audio",
                                "file": "📎 File", "location": "📍 Location", "link": msg.get("text")}.get(msg["type"], "Message")
    await db.conversations.update_one({"id": cid},
        {"$set": {"last_message": (last or "")[:200], "last_message_at": msg["created_at"]}})
    hydrated = await hydrate_message(msg)
    await broadcast_to_members(conv["members"], {"type": "message", "data": hydrated, "conversation_id": cid})
    return hydrated

@api.post("/messages")
async def send_message(body: SendMessageIn, user=Depends(current_user)):
    return await _create_and_broadcast_message(body.model_dump(), user)

@api.post("/messages/forward")
async def forward_message(body: ForwardIn, user=Depends(current_user)):
    src = await db.messages.find_one({"id": body.message_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Message not found")
    results = []
    for cid in body.conversation_ids:
        payload = {"conversation_id": cid, "type": src["type"],
                   "text": src.get("text"), "file_id": src.get("file_id"),
                   "location": src.get("location"),
                   "forwarded_from": src.get("sender_name", "Unknown")}
        try:
            results.append(await _create_and_broadcast_message(payload, user))
        except HTTPException:
            continue
    return {"forwarded": len(results)}

@api.delete("/messages/{mid}")
async def delete_message(mid: str, user=Depends(current_user)):
    msg = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not msg or msg["sender_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete")
    await db.messages.update_one({"id": mid}, {"$set": {"deleted": True, "text": None, "file_id": None}})
    conv = await db.conversations.find_one({"id": msg["conversation_id"]}, {"_id": 0})
    if conv:
        await broadcast_to_members(conv["members"], {"type": "message_deleted", "message_id": mid, "conversation_id": msg["conversation_id"]})
    return {"ok": True}

class ReactionIn(BaseModel):
    emoji: str

@api.post("/messages/{mid}/react")
async def react_to_message(mid: str, body: ReactionIn, user=Depends(current_user)):
    emoji = (body.emoji or "").strip()
    if not emoji or len(emoji) > 8:
        raise HTTPException(status_code=400, detail="Invalid emoji")
    msg = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    conv = await db.conversations.find_one({"id": msg["conversation_id"], "members": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=403, detail="Not a member")
    reactions = msg.get("reactions") or {}
    # Remove user's previous reaction (one reaction per user)
    for k in list(reactions.keys()):
        if user["id"] in reactions[k]:
            reactions[k] = [u for u in reactions[k] if u != user["id"]]
            if not reactions[k]:
                del reactions[k]
    # Toggle: if same emoji, just removed above; otherwise add
    prev_had = any(user["id"] in v for v in (msg.get("reactions") or {}).values())
    prev_emoji = next((k for k, v in (msg.get("reactions") or {}).items() if user["id"] in v), None)
    if not (prev_had and prev_emoji == emoji):
        reactions.setdefault(emoji, []).append(user["id"])
    await db.messages.update_one({"id": mid}, {"$set": {"reactions": reactions}})
    await broadcast_to_members(conv["members"], {
        "type": "reaction", "message_id": mid,
        "conversation_id": msg["conversation_id"],
        "reactions": reactions,
    })
    return {"ok": True, "reactions": reactions}

class ReadIn(BaseModel):
    conversation_id: str
    message_ids: Optional[List[str]] = None

@api.post("/messages/read")
async def mark_read(body: ReadIn, user=Depends(current_user)):
    conv = await db.conversations.find_one({"id": body.conversation_id, "members": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    q: Dict[str, Any] = {"conversation_id": body.conversation_id, "sender_id": {"$ne": user["id"]},
                          "read_by": {"$ne": user["id"]}}
    if body.message_ids:
        q["id"] = {"$in": body.message_ids}
    await db.messages.update_many(q, {"$addToSet": {"read_by": user["id"]}})
    await broadcast_to_members(conv["members"], {
        "type": "read", "conversation_id": body.conversation_id, "user_id": user["id"],
    })
    return {"ok": True}

# ---------- WebSocket ----------
class WSManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        async with self.lock:
            self.connections.setdefault(user_id, []).append(ws)

    async def disconnect(self, user_id: str, ws: WebSocket):
        async with self.lock:
            if user_id in self.connections:
                self.connections[user_id] = [c for c in self.connections[user_id] if c is not ws]
                if not self.connections[user_id]:
                    self.connections.pop(user_id, None)

    async def send(self, user_id: str, data: dict):
        conns = self.connections.get(user_id, [])
        dead = []
        for c in conns:
            try:
                await c.send_json(data)
            except Exception:
                dead.append(c)
        for d in dead:
            await self.disconnect(user_id, d)

    def is_online(self, user_id: str) -> bool:
        return bool(self.connections.get(user_id))

manager = WSManager()

async def broadcast_to_members(member_ids: List[str], data: dict):
    for uid in member_ids:
        await manager.send(uid, data)

@app.websocket("/api/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(...)):
    user = await user_from_token(token)
    if not user:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    uid = user["id"]
    await manager.connect(uid, websocket)
    await db.users.update_one({"id": uid}, {"$set": {"online": True, "last_seen": now_iso()}})
    # Notify peers (members of any conv) that this user is online
    convs = await db.conversations.find({"members": uid}, {"_id": 0, "members": 1}).to_list(500)
    peers = {m for c in convs for m in c["members"] if m != uid}
    for p in peers:
        await manager.send(p, {"type": "presence", "user_id": uid, "online": True})
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                evt = json.loads(raw)
            except Exception:
                continue
            t = evt.get("type")
            if t == "typing":
                cid = evt.get("conversation_id")
                if not cid:
                    continue
                conv = await db.conversations.find_one({"id": cid, "members": uid}, {"_id": 0, "members": 1})
                if conv:
                    for m in conv["members"]:
                        if m != uid:
                            await manager.send(m, {"type": "typing", "conversation_id": cid,
                                                    "user_id": uid, "user_name": user["name"],
                                                    "is_typing": bool(evt.get("is_typing"))})
            elif t == "ping":
                await websocket.send_json({"type": "pong"})
            elif t in ("call_offer", "call_answer", "call_ice", "call_end", "call_reject", "call_ringing"):
                target_id = evt.get("to")
                if target_id:
                    payload = {**evt, "from": uid, "from_name": user["name"],
                               "from_avatar": user.get("avatar")}
                    await manager.send(target_id, payload)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        await manager.disconnect(uid, websocket)
        if not manager.is_online(uid):
            await db.users.update_one({"id": uid}, {"$set": {"online": False, "last_seen": now_iso()}})
            for p in peers:
                await manager.send(p, {"type": "presence", "user_id": uid, "online": False})

# ---------- Misc ----------
@api.get("/")
async def root():
    return {"app": "Aasha", "status": "ok", "time": now_iso()}

# ---------- Startup ----------
@app.on_event("startup")
async def on_start():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("phone")
        await db.users.create_index("id", unique=True)
        await db.conversations.create_index("members")
        await db.conversations.create_index("id", unique=True)
        await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
        await db.messages.create_index("id", unique=True)
        await db.files.create_index("id", unique=True)
    except Exception as e:
        logger.error(f"Index creation: {e}")
    init_storage()
    logger.info("Aasha started")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
