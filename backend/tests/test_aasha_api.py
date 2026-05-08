"""Aasha backend API tests"""
import os, time, io, json, uuid, asyncio, websockets, pytest, requests

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://instant-share-84.preview.emergentagent.com').rstrip('/')
API = f"{BASE}/api"

# read frontend env if available
try:
    with open('/app/frontend/.env') as f:
        for ln in f:
            if ln.startswith('REACT_APP_BACKEND_URL='):
                BASE = ln.split('=',1)[1].strip().rstrip('/'); API=f"{BASE}/api"
except Exception:
    pass

S = requests.Session()
ALICE = {"email": "alice@example.com", "password": "password123"}
BOB = {"email": "bob@example.com", "password": "password123"}

state = {}

def _login(creds):
    r = S.post(f"{API}/auth/login", json=creds, timeout=20)
    if r.status_code != 200:
        # try register
        name = creds["email"].split("@")[0].title()
        S.post(f"{API}/auth/register", json={"name": name, **creds}, timeout=20)
        r = S.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()

def test_health():
    r = S.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"

def test_register_duplicate_and_login():
    a = _login(ALICE); b = _login(BOB)
    state["alice"]=a; state["bob"]=b
    assert "token" in a and a["user"]["email"]=="alice@example.com"
    # wrong password
    r = S.post(f"{API}/auth/login", json={"email":"alice@example.com","password":"wrong"}, timeout=15)
    assert r.status_code == 401

def test_me():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    r=S.get(f"{API}/auth/me",headers=h,timeout=10); assert r.status_code==200
    assert r.json()["email"]=="alice@example.com"

def test_otp_flow():
    phone="+919999990777"
    r=S.post(f"{API}/auth/otp/send",json={"phone":phone},timeout=10); assert r.status_code==200
    r=S.post(f"{API}/auth/otp/verify",json={"phone":phone,"otp":"123456","name":"OTPUser"},timeout=10)
    assert r.status_code==200 and "token" in r.json()
    r=S.post(f"{API}/auth/otp/verify",json={"phone":phone,"otp":"12","name":"x"},timeout=10)
    assert r.status_code==400

def test_google_bogus():
    r=S.post(f"{API}/auth/google/session",json={"session_id":"bogus123"},timeout=20)
    assert r.status_code==400

def test_profile_update():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    r=S.patch(f"{API}/auth/profile",headers=h,json={"bio":"Testing Aasha"},timeout=10)
    assert r.status_code==200 and r.json()["bio"]=="Testing Aasha"

def test_search_users():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    r=S.get(f"{API}/users/search",params={"q":"bob"},headers=h,timeout=10)
    assert r.status_code==200
    arr=r.json(); assert any(u["email"]=="bob@example.com" for u in arr)
    assert all(u["id"]!=state["alice"]["user"]["id"] for u in arr)

def test_create_dm_idempotent_and_group():
    ha={"Authorization":f"Bearer {state['alice']['token']}"}
    bob_id=state["bob"]["user"]["id"]
    r=S.post(f"{API}/conversations",headers=ha,json={"member_ids":[bob_id]},timeout=10)
    assert r.status_code==200; c1=r.json(); state["dm"]=c1
    r2=S.post(f"{API}/conversations",headers=ha,json={"member_ids":[bob_id]},timeout=10)
    assert r2.json()["id"]==c1["id"]
    # group: need a third member - create OTP user
    r3=S.post(f"{API}/auth/otp/verify",json={"phone":"+919999991111","otp":"111111","name":"Carol"},timeout=10)
    carol=r3.json()
    r4=S.post(f"{API}/conversations",headers=ha,json={"member_ids":[bob_id,carol["user"]["id"]],"is_group":True,"name":"TEST_Group"},timeout=10)
    assert r4.status_code==200 and r4.json()["is_group"]==True
    state["group"]=r4.json()

def test_list_conversations():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    r=S.get(f"{API}/conversations",headers=h,timeout=10); assert r.status_code==200
    convs=r.json(); ids=[c["id"] for c in convs]
    assert state["dm"]["id"] in ids and state["group"]["id"] in ids
    dm=next(c for c in convs if c["id"]==state["dm"]["id"])
    assert dm.get("other_user",{}).get("email")=="bob@example.com"

def test_send_text_and_list():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    r=S.post(f"{API}/messages",headers=h,json={"conversation_id":state["dm"]["id"],"type":"text","text":"Hello Bob"},timeout=10)
    assert r.status_code==200; state["msg_text"]=r.json()
    r2=S.get(f"{API}/conversations/{state['dm']['id']}/messages",headers=h,timeout=10)
    assert r2.status_code==200 and any(m["text"]=="Hello Bob" for m in r2.json())

def test_file_upload_and_image_msg():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    img=b"\x89PNG\r\n\x1a\n"+b"\x00"*100
    files={"file":("t.png",img,"image/png")}
    r=S.post(f"{API}/files/upload",headers=h,files=files,timeout=60)
    assert r.status_code==200, r.text
    fid=r.json()["id"]; state["file_id"]=fid
    # download
    r2=S.get(f"{API}/files/{fid}",params={"auth":state['alice']['token']},timeout=30)
    assert r2.status_code==200 and r2.headers.get("content-type","").startswith("image/")
    # send image msg
    r3=S.post(f"{API}/messages",headers=h,json={"conversation_id":state["dm"]["id"],"type":"image","file_id":fid},timeout=10)
    assert r3.status_code==200 and r3.json().get("file",{}).get("url","").endswith(fid)

def test_send_location_and_forward_and_delete():
    h={"Authorization":f"Bearer {state['alice']['token']}"}
    r=S.post(f"{API}/messages",headers=h,json={"conversation_id":state["dm"]["id"],"type":"location","location":{"lat":12.9,"lng":77.6}},timeout=10)
    assert r.status_code==200
    # forward text msg to group
    r2=S.post(f"{API}/messages/forward",headers=h,json={"message_id":state["msg_text"]["id"],"conversation_ids":[state["group"]["id"]]},timeout=10)
    assert r2.status_code==200 and r2.json()["forwarded"]==1
    # delete (only sender allowed)
    mid=state["msg_text"]["id"]
    hb={"Authorization":f"Bearer {state['bob']['token']}"}
    rb=S.delete(f"{API}/messages/{mid}",headers=hb,timeout=10); assert rb.status_code==403
    ra=S.delete(f"{API}/messages/{mid}",headers=h,timeout=10); assert ra.status_code==200

@pytest.mark.asyncio
async def test_websocket():
    ws_base=BASE.replace("https://","wss://").replace("http://","ws://")
    bad=f"{ws_base}/api/ws?token=invalid"
    try:
        async with websockets.connect(bad) as w:
            await w.recv()
            assert False, "should have closed"
    except Exception:
        pass
    good=f"{ws_base}/api/ws?token={state['alice']['token']}"
    good_b=f"{ws_base}/api/ws?token={state['bob']['token']}"
    async with websockets.connect(good) as wa, websockets.connect(good_b) as wb:
        await asyncio.sleep(0.5)
        # bob sends a typing event - alice should receive
        await wb.send(json.dumps({"type":"typing","conversation_id":state["dm"]["id"],"is_typing":True}))
        got_typing=False; got_msg=False
        # send a message via REST from bob -> alice should see ws 'message'
        h={"Authorization":f"Bearer {state['bob']['token']}"}
        S.post(f"{API}/messages",headers=h,json={"conversation_id":state["dm"]["id"],"type":"text","text":"hi from bob"},timeout=10)
        try:
            for _ in range(8):
                evt=json.loads(await asyncio.wait_for(wa.recv(),timeout=3))
                if evt.get("type")=="typing": got_typing=True
                if evt.get("type")=="message": got_msg=True
                if got_typing and got_msg: break
        except asyncio.TimeoutError:
            pass
        assert got_msg, "did not receive message event over WS"
        assert got_typing, "did not receive typing event over WS"
