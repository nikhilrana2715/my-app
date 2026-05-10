import React, { useEffect, useRef, useState, useCallback } from "react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCall } from "@/lib/call";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import MessageBubble from "@/components/MessageBubble";
import Composer from "@/components/Composer";
import { ArrowLeft, Phone, Video, Search, MoreVertical } from "lucide-react";
import { toast } from "sonner";

export default function ChatWindow({ conversation, presence, typing, onBack, socket, registerMessageHandler, onForward }) {
  const { user } = useAuth();
  const { startCall } = useCall() || {};
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const isOnline = !conversation.is_group && conversation.other_user && (presence[conversation.other_user.id] ?? conversation.other_user.online);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/conversations/${conversation.id}/messages`);
      setMessages(data);
    } catch (e) { toast.error(formatErr(e)); }
    finally { setLoading(false); }
  }, [conversation.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // register socket message handler
  useEffect(() => {
    registerMessageHandler((evt) => {
      if (evt.type === "message" && evt.conversation_id === conversation.id) {
        setMessages((m) => {
          if (m.some((x) => x.id === evt.data.id)) return m;
          return [...m, evt.data];
        });
      } else if (evt.type === "message_deleted" && evt.conversation_id === conversation.id) {
        setMessages((m) => m.map((x) => x.id === evt.message_id ? { ...x, deleted: true, text: null, file: null } : x));
      } else if (evt.type === "reaction" && evt.conversation_id === conversation.id) {
        setMessages((m) => m.map((x) => x.id === evt.message_id ? { ...x, reactions: evt.reactions } : x));
      } else if (evt.type === "read" && evt.conversation_id === conversation.id) {
        setMessages((m) => m.map((x) => {
          if (x.sender_id === user.id && !(x.read_by || []).includes(evt.user_id)) {
            return { ...x, read_by: [...(x.read_by || []), evt.user_id] };
          }
          return x;
        }));
      }
    });
  }, [registerMessageHandler, conversation.id, user.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = async (payload) => {
    try {
      await api.post("/messages", { conversation_id: conversation.id, ...payload });
    } catch (e) { toast.error(formatErr(e)); }
  };

  const onTyping = (isTyping) => {
    socket?.send({ type: "typing", conversation_id: conversation.id, is_typing: isTyping });
  };

  const deleteMessage = async (mid) => {
    try { await api.delete(`/messages/${mid}`); } catch (e) { toast.error(formatErr(e)); }
  };

  const otherMembersCount = (conversation.members?.length || 2) - 1;

  const initiateCall = (kind) => {
    if (conversation.is_group) { toast.info("Group calls not supported yet — only 1-on-1"); return; }
    const peer = conversation.other_user;
    if (!peer) return toast.error("Cannot call this user");
    startCall?.(peer, kind);
  };

  return (
    <div className="flex flex-col h-full bg-aasha-bg" data-testid="chat-window">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-aasha-line bg-white">
        <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={onBack} data-testid="btn-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="relative">
          <UserAvatar user={!conversation.is_group ? conversation.other_user : { name: conversation.name, avatar: conversation.avatar }} size={44} />
          {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-aasha-online ring-2 ring-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-aasha-ink truncate" data-testid="chat-title">{conversation.name}</div>
          <div className="text-xs text-aasha-inkSoft truncate">
            {typing ? <span className="text-aasha-orange">{typing.name} is typing…</span>
              : conversation.is_group
                ? `${conversation.member_users?.length || conversation.members?.length || 0} members`
                : isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full hidden sm:inline-flex" onClick={() => initiateCall("audio")} data-testid="btn-call-audio"><Phone className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="rounded-full hidden sm:inline-flex" onClick={() => initiateCall("video")} data-testid="btn-call-video"><Video className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="rounded-full" disabled><Search className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="rounded-full" disabled><MoreVertical className="w-4 h-4" /></Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 chat-bg" data-testid="messages-list">
        {loading ? (
          <div className="text-center text-aasha-inkSoft text-sm">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-aasha-inkSoft text-sm mt-12">No messages yet — say hello 🌅</div>
        ) : (
          messages.map((m, idx) => {
            const prev = messages[idx - 1];
            const showAvatar = conversation.is_group && m.sender_id !== user.id && (!prev || prev.sender_id !== m.sender_id);
            return (
              <MessageBubble
                key={m.id}
                msg={m}
                isMine={m.sender_id === user.id}
                showSenderName={conversation.is_group && m.sender_id !== user.id && (!prev || prev.sender_id !== m.sender_id)}
                showAvatar={showAvatar}
                onForward={() => onForward(m)}
                onDelete={() => deleteMessage(m.id)}
                otherMembersCount={otherMembersCount}
              />
            );
          })
        )}
      </div>

      <Composer onSend={sendMessage} onTyping={onTyping} />
    </div>
  );
}
