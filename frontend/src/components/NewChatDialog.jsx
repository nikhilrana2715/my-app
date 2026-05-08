import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { api, formatErr } from "@/lib/api";
import { Search } from "lucide-react";
import { toast } from "sonner";

export default function NewChatDialog({ open, onOpenChange, onPick }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/users/search", { params: { q } });
        setUsers(data);
      } catch (e) { toast.error(formatErr(e)); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-aasha-bg sm:max-w-md" data-testid="dialog-new-chat">
        <DialogHeader><DialogTitle className="font-display">New chat</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aasha-inkMuted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-9" data-testid="search-users" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-2">
          {loading ? <div className="p-4 text-sm text-aasha-inkSoft">Searching…</div>
            : users.length === 0 ? <div className="p-4 text-sm text-aasha-inkSoft">No users found</div>
            : users.map((u) => (
              <button key={u.id} onClick={() => onPick(u.id)} data-testid={`user-${u.id}`}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white flex items-center gap-3">
                <UserAvatar user={u} size={40} />
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{u.name}</div>
                  <div className="text-xs text-aasha-inkSoft truncate">{u.email}</div>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
