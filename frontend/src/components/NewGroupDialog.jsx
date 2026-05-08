import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/UserAvatar";
import { api, formatErr } from "@/lib/api";
import { toast } from "sonner";

export default function NewGroupDialog({ open, onOpenChange, onCreate }) {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [picked, setPicked] = useState({});

  useEffect(() => {
    if (!open) { setName(""); setQ(""); setPicked({}); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/users/search", { params: { q } });
        setUsers(data);
      } catch (e) { toast.error(formatErr(e)); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const ids = Object.keys(picked).filter((k) => picked[k]);
  const submit = () => {
    if (!name.trim() || ids.length < 1) { toast.error("Group name and at least 1 member required"); return; }
    onCreate({ name: name.trim(), member_ids: ids });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-aasha-bg sm:max-w-md" data-testid="dialog-new-group">
        <DialogHeader><DialogTitle className="font-display">New group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Group name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Family, Friends…" data-testid="input-group-name" />
          </div>
          <div>
            <Label>Add members</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" />
          </div>
          <div className="max-h-[40vh] overflow-y-auto">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white cursor-pointer">
                <Checkbox checked={!!picked[u.id]} onCheckedChange={(v) => setPicked((p) => ({ ...p, [u.id]: !!v }))} data-testid={`pick-${u.id}`} />
                <UserAvatar user={u} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate">{u.name}</div>
                  <div className="text-xs text-aasha-inkSoft truncate">{u.email}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white" data-testid="btn-create-group">Create group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
