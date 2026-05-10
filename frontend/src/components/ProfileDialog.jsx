import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { api, formatErr } from "@/lib/api";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

export default function ProfileDialog({ open, onOpenChange }) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open || !user) return;
    setName(user.name || "");
    setBio(user.bio || "");
    setAvatar(user.avatar || "");
  }, [open, user]);

  const onPickFile = () => fileRef.current?.click();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5MB)"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // Store as relative path; UserAvatar will resolve via fileUrl()
      setAvatar(`aasha-file://${data.id}`);
      toast.success("Photo uploaded — click Save to apply");
    } catch (err) { toast.error(formatErr(err)); }
    finally { setUploading(false); e.target.value = ""; }
  };

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
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <UserAvatar user={{ ...user, name, avatar }} size={96} />
              <button
                type="button"
                onClick={onPickFile}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white flex items-center justify-center shadow-lg ring-2 ring-aasha-bg"
                data-testid="btn-upload-dp"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <button
              type="button"
              onClick={onPickFile}
              disabled={uploading}
              className="text-xs text-aasha-orange font-semibold hover:underline"
            >
              Change profile photo
            </button>
          </div>
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" />
          </div>
          <div>
            <Label>Bio / Status</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} data-testid="input-profile-bio" />
          </div>
          <div>
            <Label className="text-xs text-aasha-inkSoft">Or paste an image URL</Label>
            <Input value={avatar.startsWith("aasha-file://") ? "" : avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
          </div>
          <div className="text-xs text-aasha-inkSoft">
            <div><span className="font-semibold">Email:</span> {user.email}</div>
            {user.phone && <div><span className="font-semibold">Phone:</span> {user.phone}</div>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={uploading} className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white" data-testid="btn-save-profile">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
