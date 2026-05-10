# Aasha — Product Requirements Document (PRD)

## Original Problem Statement
> "Mujhe ek aasha aap bana ke do like WhatsApp ke terha mai phone mai or laptop mai install kar saku and usmai (messages, link, images, audio, video, pdf, doc, zip, html, file location etc.) sab send and receive kar saku aasha aapa bana ke do or wo aapa ekdam light wait ho bahut simple ho phone number se and Gmail se login and signup ka option ho aasha hona chiya or usmai share, forward ka ve option hona chiya and bahu simple hona chiya aasha bana do"

A WhatsApp-like, lightweight, simple chat app called **Aasha** (आशा — "Hope") that works on phone and laptop, supports rich messaging (text, links, images, audio, video, pdf, doc, zip, html, location), share & forward, with phone number and Gmail login.

---

## Architecture
- **Backend**: FastAPI (Python) + MongoDB (motor) + WebSocket (built-in FastAPI). All routes prefixed `/api`. Single file: `/app/backend/server.py`.
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn/UI. Built bundle: `/app/frontend/build`. Total gzipped JS: 155 KB (lightweight).
- **Storage**: Emergent Object Storage for files (images/video/audio/docs/zip/html). DB stores file metadata.
- **Auth**: Custom JWT (Email/Password) + Mock Phone OTP (any 6-digit) + Emergent-managed Google Auth.
- **Realtime**: WebSocket at `/api/ws?token=<jwt>` for messages, presence, typing.
- **PWA**: `manifest.json` + theme colors + apple-mobile tags so users can "Add to Home Screen" on Android/iOS/desktop.

## User Personas
- **Family/friends user**: wants to chat with people and share photos/files quickly.
- **Group communicator**: wants to talk to multiple people at once (groups).
- **Multi-device user**: same account on phone + laptop, browser-based.

## Core Requirements (Static)
1. Email + Password sign-up/sign-in (JWT) ✅
2. Phone number sign-in (Mock OTP, any 6 digits) ✅
3. Google sign-in (Emergent-managed, no Google Cloud setup) ✅
4. 1-on-1 chats (idempotent DM creation) ✅
5. Group chats (admin-aware) ✅
6. Real-time message delivery + typing indicators + online presence ✅
7. Send: text, link (auto-detected & rendered with anchor), image, video, audio, file (pdf/doc/zip/html etc.), location ✅
8. Forward message to multiple chats ✅
9. Share message (Web Share API or copy fallback) ✅
10. Soft-delete own messages ✅
11. Profile (name, bio, avatar URL) editable ✅
12. PWA installable ✅

---

## What's Been Implemented (Iteration 1 — Feb 2026)
- ✅ Backend (server.py): all 8 auth endpoints, users/search, conversations CRUD, messages CRUD + forward + soft-delete, file upload/download via Emergent Object Storage, WebSocket realtime layer, indexes.
- ✅ Frontend: AuthPage (Email / Phone / Google tabs), AuthCallback (Google session_id exchange), ChatPage (split-view layout), Sidebar (search + new chat/group + profile menu), ChatWindow (header + scrollable messages + composer), MessageBubble (text/image/video/audio/file/location/link + Forward/Share/Copy/Delete dropdown), Composer (text + file/photo/video/location attach), New Chat / New Group / Profile / Forward dialogs, EmptyState.
- ✅ Design: Cabinet Grotesk + Manrope fonts, warm sunrise palette (#F26C4F primary on #FCFBF8), unique non-AI-slop look. Beautiful bubble entrance animations.
- ✅ PWA: manifest.json with theme color, install-ready.
- ✅ Testing: 13/13 backend pytest passed; 9/9 frontend Playwright e2e passed.

---

## Test Credentials (see `/app/memory/test_credentials.md`)
- alice@example.com / password123
- bob@example.com / password123

## Backlog (P0 / P1 / P2)
### P0 — High Priority Next
- [ ] Voice notes (record + send audio directly from browser; uses MediaRecorder API).
- [ ] Read receipts (blue ticks): backend already tracks `read_by`; surface in UI.
- [ ] Image/video previews in conversation list ("📷 Photo" → thumbnail).
- [ ] Real Google OAuth verification with a real Google account from end-user.

### P1 — Medium Priority
- [ ] Real Phone OTP via Twilio (replace mock).
- [ ] Voice & video calls (WebRTC with TURN/STUN).
- [ ] Reactions (like, love, etc.) on messages.
- [ ] Reply-to / quote in UI (backend already supports `reply_to` field).
- [ ] Message search within a conversation.
- [ ] Push notifications (Web Push + service worker).
- [ ] Group admin actions: add/remove members, promote, leave.
- [ ] Native APK build via Capacitor or PWABuilder.com.

### P2 — Nice to Have
- [ ] End-to-end encryption.
- [ ] Disappearing messages.
- [ ] Stories / Status updates.
- [ ] Themes & wallpapers per chat.
- [ ] Multi-language UI (Hindi/English toggle).
- [ ] Backup / export chat as text.

---

## Key Files
- `/app/backend/server.py`
- `/app/backend/.env` (MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY, APP_NAME)
- `/app/frontend/src/App.js`, `/app/frontend/src/pages/*`, `/app/frontend/src/components/*`, `/app/frontend/src/lib/*`
- `/app/frontend/public/manifest.json`
- `/app/frontend/build/` — production bundle ready

---

## Phase 2 Updates (Feb 2026) — Free features
- ✅ **Voice notes**: Composer mic button uses MediaRecorder (webm/m4a). Tap mic → recording bar with timer + send/cancel. Uploaded as audio message via existing `/api/files/upload` and rendered with `<audio controls>`.
- ✅ **Read receipts (✓✓ blue ticks)**: Backend already tracked `read_by`. Added `POST /api/messages/read` + WebSocket `read` broadcast. UI shows: single ✓ (sent), grey ✓✓ (delivered), blue ✓✓ (all read). For groups, blue ticks only when ALL other members have read.
- ✅ **Reactions**: New endpoint `POST /api/messages/{mid}/react` (toggle, one reaction per user). Quick picker in bubble dropdown with 👍 ❤️ 😂 😮 😢 🙏. Reaction badges shown below bubble with count. Realtime sync via WebSocket `reaction` event.

### Performance fixes
- N+1 queries eliminated in `list_conversations` (batch `$in` + aggregation pipeline) and `list_messages` (batch file fetch). Deployment health check: PASS ✅


---

## Iteration 3 Fixes (Feb 2026)
1. **🎙️ Audio/Video calls** — implemented P2P WebRTC with Google STUN servers and WebSocket signaling (`call_offer`, `call_answer`, `call_ice`, `call_end`, `call_reject`). New files: `/app/frontend/src/lib/call.jsx` (CallProvider) + `/app/frontend/src/components/CallModal.jsx`. Wired phone & video buttons in chat header (1-on-1 only).
2. **⬇️ Downloads now work** — root cause was nested `<button>` inside `<button>` in MessageBubble; replaced outer with `<div>` and added a dedicated "..." action trigger in the corner. Downloads are forced via fetch→blob→`<a download>` click. Save option also added in dropdown menu and on hover overlays for image/video/audio.
3. **📍 Location → Google Maps** — share now opens `https://www.google.com/maps?q=lat,lng` and the message shows a small static map preview from OpenStreetMap.
4. **📲 OTP UX clarified** — Phone tab now shows a "Demo" banner explaining that real SMS isn't connected; clicking "Send OTP" auto-fills `123456` so user can verify in one tap.
5. **🖼️ Profile DP upload** — Profile dialog now has a Camera button on the avatar that uploads the photo via `/api/files/upload`. Stored as `aasha-file://<id>` and `UserAvatar` resolves it to an authenticated download URL (`?auth=<jwt>`) so other users see your DP too.

