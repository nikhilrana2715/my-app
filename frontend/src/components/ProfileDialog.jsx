import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { api, formatErr } from "@/lib/api";
import { toast } from "sonner";

export default function ProfileDialog({ open, onOpenChange }) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setName(user.name || "");
    setBio(user.bio || "");
    setAvatar(user.avatar || "");
  }, [open, user]);

  const save = async () => {
    try {
      const { data } = await api.patch("/auth/profile", { name, bio, avatar });
      setUser(data);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e) { toast.error(formatErr(e)); }
  };

  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-aasha-bg sm:max-w-md" data-testid="dialog-profile">
        <DialogHeader><DialogTitle className="font-display">Your profile</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar user={{ ...user, name, avatar }} size={64} />
            <div className="flex-1">
              <Label>Avatar URL (optional)</Label>
              <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" />
          </div>
          <div>
            <Label>Bio / Status</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} data-testid="input-profile-bio" />
          </div>
          <div className="text-xs text-aasha-inkSoft">
            <div><span className="font-semibold">Email:</span> {user.email}</div>
            {user.phone && <div><span className="font-semibold">Phone:</span> {user.phone}</div>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white" data-testid="btn-save-profile">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
