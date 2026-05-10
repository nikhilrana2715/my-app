import React, { useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, Plus, Users, MessageSquarePlus, MoreVertical, LogOut, User as UserIcon, Sparkles, MessageCircle, Phone } from "lucide-react";
import { formatChatTime } from "@/lib/utils";
import CallsPanel from "@/components/CallsPanel";

export default function Sidebar({ conversations, activeId, presence, typing, onSelect, onNewChat, onNewGroup, onProfile }) {
  const { user, logout } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("chats");
  const filtered = conversations.filter((c) => (c.name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col h-full" data-testid="sidebar">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-aasha-orange flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl text-aasha-ink">Aasha</h1>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="btn-new">
                <Plus className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onNewChat} data-testid="menu-new-chat">
                <MessageSquarePlus className="w-4 h-4 mr-2" /> New chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewGroup} data-testid="menu-new-group">
                <Users className="w-4 h-4 mr-2" /> New group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="btn-menu">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onProfile} data-testid="menu-profile">
                <UserIcon className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} data-testid="menu-logout" className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-1 bg-white border border-aasha-line rounded-full p-1 mb-2">
          <button
            onClick={() => setTab("chats")}
            data-testid="tab-chats"
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-full text-sm py-1.5 font-semibold transition-all ${
              tab === "chats" ? "bg-aasha-orange text-white" : "text-aasha-inkSoft hover:text-aasha-ink"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" /> Chats
          </button>
          <button
            onClick={() => setTab("calls")}
            data-testid="tab-calls"
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-full text-sm py-1.5 font-semibold transition-all ${
              tab === "calls" ? "bg-aasha-orange text-white" : "text-aasha-inkSoft hover:text-aasha-ink"
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> Calls
          </button>
        </div>
        {tab === "chats" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aasha-inkMuted" />
            <Input
              data-testid="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chats"
              className="pl-9 bg-white border-aasha-line rounded-full h-10"
            />
          </div>
        )}
      </div>

      {tab === "calls" ? (
        <div className="flex-1 overflow-hidden">
          <CallsPanel />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-aasha-inkSoft mt-12 px-6">
            No conversations yet. Tap <Plus className="inline w-4 h-4" /> to start a new chat.
          </div>
        ) : filtered.map((c) => {
          const isActive = c.id === activeId;
          const isOnline = !c.is_group && c.other_user && (presence[c.other_user.id] ?? c.other_user.online);
          const isTyping = typing?.[c.id];
          return (
            <button
              key={c.id}
              data-testid={`chat-item-${c.id}`}
              onClick={() => onSelect(c)}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150 mb-0.5 ${
                isActive ? "bg-white shadow-sm border border-aasha-line" : "hover:bg-white/70 active:scale-[0.99]"
              }`}
            >
              <div className="relative">
                <UserAvatar user={!c.is_group ? c.other_user : { name: c.name, avatar: c.avatar }} size={48} />
                {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-aasha-online ring-2 ring-aasha-sidebar" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display font-semibold text-aasha-ink truncate">{c.name || "Unknown"}</div>
                  <div className="text-[11px] text-aasha-inkMuted shrink-0">{formatChatTime(c.last_message_at)}</div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-sm text-aasha-inkSoft truncate">
                    {isTyping ? <span className="text-aasha-orange italic">typing…</span> : (c.last_message || "Say hi 🌅")}
                  </div>
                  {c.unread > 0 && (
                    <span className="bg-aasha-orange text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center" data-testid={`unread-${c.id}`}>
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      )}

      <div className="border-t border-aasha-line p-3 flex items-center gap-2 bg-aasha-sidebar">
        <UserAvatar user={user} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm truncate">{user?.name}</div>
          <div className="text-xs text-aasha-inkSoft truncate">{user?.email}</div>
        </div>
      </div>
    </div>
  );
}
