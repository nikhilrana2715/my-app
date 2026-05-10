import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ChatSocket } from "@/lib/socket";
import { CallProvider, useCall } from "@/lib/call";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import EmptyState from "@/components/EmptyState";
import NewChatDialog from "@/components/NewChatDialog";
import NewGroupDialog from "@/components/NewGroupDialog";
import ProfileDialog from "@/components/ProfileDialog";
import ForwardDialog from "@/components/ForwardDialog";
import CallModal from "@/components/CallModal";
import { toast } from "sonner";

function ChatPageInner() {
  const { user } = useAuth();
  const call = useCall();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const [presence, setPresence] = useState({}); // user_id -> bool
  const [typingByConv, setTypingByConv] = useState({}); // cid -> {user_id, name, timer}
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const messageHandlerRef = useRef(() => {});
  const registerMessageHandler = useCallback((fn) => {
    messageHandlerRef.current = fn || (() => {});
  }, []);
  const socketRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/conversations");
      setConversations(data);
      return data;
    } catch (e) { toast.error(formatErr(e)); return []; }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // WebSocket
  useEffect(() => {
    const sock = new ChatSocket({
      onMessage: (evt) => {
        if (evt.type === "presence") {
          setPresence((p) => ({ ...p, [evt.user_id]: evt.online }));
        } else if (evt.type === "message") {
          // bubble to active chat handler
          messageHandlerRef.current?.(evt);
          // update conversations preview
          setConversations((cs) => {
            const idx = cs.findIndex((c) => c.id === evt.conversation_id);
            if (idx === -1) { loadConversations(); return cs; }
            const conv = { ...cs[idx], last_message: evt.data.text || `[${evt.data.type}]`, last_message_at: evt.data.created_at };
            if (evt.data.sender_id !== user?.id && activeIdRef.current !== evt.conversation_id) {
              conv.unread = (conv.unread || 0) + 1;
            }
            const out = [...cs]; out.splice(idx, 1); return [conv, ...out];
          });
        } else if (evt.type === "message_deleted") {
          messageHandlerRef.current?.(evt);
        } else if (evt.type?.startsWith("call_")) {
          call?.handleSignal(evt);
        } else if (evt.type === "typing") {
          setTypingByConv((t) => {
            const next = { ...t };
            if (evt.is_typing) {
              next[evt.conversation_id] = { user_id: evt.user_id, name: evt.user_name, ts: Date.now() };
            } else {
              delete next[evt.conversation_id];
            }
            return next;
          });
        }
      },
    });
    sock.connect();
    socketRef.current = sock;
    // expose for CallProvider signaling
    if (typeof window !== "undefined") window.__aashaSocket = sock;
    return () => { sock.disconnect(); if (typeof window !== "undefined") window.__aashaSocket = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // typing auto-clear
  useEffect(() => {
    const t = setInterval(() => {
      setTypingByConv((tp) => {
        const out = {};
        const now = Date.now();
        for (const k in tp) if (now - (tp[k]?.ts || 0) < 4000) out[k] = tp[k];
        return out;
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  const handleSelect = (conv) => {
    setActiveId(conv.id);
    setConversations((cs) => cs.map((c) => c.id === conv.id ? { ...c, unread: 0 } : c));
  };

  const startConversationWith = async (uid) => {
    try {
      const { data } = await api.post("/conversations", { member_ids: [uid], is_group: false });
      await loadConversations();
      setActiveId(data.id);
      setNewChatOpen(false);
    } catch (e) { toast.error(formatErr(e)); }
  };

  const createGroup = async ({ name, member_ids }) => {
    try {
      const { data } = await api.post("/conversations", { member_ids, is_group: true, name });
      await loadConversations();
      setActiveId(data.id);
      setNewGroupOpen(false);
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div className="h-screen w-full grid grid-cols-1 md:grid-cols-[360px_1fr] bg-aasha-bg overflow-hidden">
      <div className={`${activeId ? "hidden md:block" : "block"} h-full overflow-hidden border-r border-aasha-line bg-aasha-sidebar`}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          presence={presence}
          typing={typingByConv}
          onSelect={handleSelect}
          onNewChat={() => setNewChatOpen(true)}
          onNewGroup={() => setNewGroupOpen(true)}
          onProfile={() => setProfileOpen(true)}
        />
      </div>
      <div className={`${activeId ? "block" : "hidden md:block"} h-full overflow-hidden`}>
        {activeConv ? (
          <ChatWindow
            key={activeConv.id}
            conversation={activeConv}
            presence={presence}
            typing={typingByConv[activeConv.id]}
            onBack={() => setActiveId(null)}
            socket={socketRef.current}
            registerMessageHandler={registerMessageHandler}
            onForward={(msg) => setForwardMsg(msg)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onPick={startConversationWith} />
      <NewGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} onCreate={createGroup} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ForwardDialog open={!!forwardMsg} onOpenChange={(o) => !o && setForwardMsg(null)} message={forwardMsg} conversations={conversations} />
      <CallModal />
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  return (
    <CallProvider currentUser={user}>
      <ChatPageInner />
    </CallProvider>
  );
}
