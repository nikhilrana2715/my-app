import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/UserAvatar";
import { api, formatErr } from "@/lib/api";
import { toast } from "sonner";

export default function ForwardDialog({ open, onOpenChange, message, conversations }) {
  const [picked, setPicked] = useState({});

  useEffect(() => { if (!open) setPicked({}); }, [open]);

  const submit = async () => {
    const ids = Object.keys(picked).filter((k) => picked[k]);
    if (!ids.length || !message) return;
    try {
      await api.post("/messages/forward", { message_id: message.id, conversation_ids: ids });
      toast.success(`Forwarded to ${ids.length} chat${ids.length > 1 ? "s" : ""}`);
      onOpenChange(false);
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-aasha-bg sm:max-w-md" data-testid="dialog-forward">
        <DialogHeader><DialogTitle className="font-display">Forward to…</DialogTitle></DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          {conversations.map((c) => (
            <label key={c.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white cursor-pointer">
              <Checkbox checked={!!picked[c.id]} onCheckedChange={(v) => setPicked((p) => ({ ...p, [c.id]: !!v }))} data-testid={`fwd-${c.id}`} />
              <UserAvatar user={!c.is_group ? c.other_user : { name: c.name, avatar: c.avatar }} size={36} />
              <div className="font-display font-semibold truncate flex-1">{c.name}</div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={submit} className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white" data-testid="btn-do-forward">Forward</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
