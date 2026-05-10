import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Paperclip, Send, MapPin, Image as ImgIcon, FileText, Loader2, Mic, Square, Trash2 } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { toast } from "sonner";

export default function Composer({ onSend, onTyping }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const typingTimer = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recTimer = useRef(null);
  const cancelRef = useRef(false);

  const handleType = (v) => {
    setText(v);
    onTyping?.(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping?.(false), 1500);
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    const isLink = /^https?:\/\//i.test(t);
    setText("");
    onTyping?.(false);
    await onSend({ type: isLink ? "link" : "text", text: t });
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
  };

  const detectType = (mime) => {
    if (!mime) return "file";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "file";
  };

  const uploadAndSend = async (file, forcedType) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await onSend({ type: forcedType || detectType(file.type), file_id: data.id, text: text.trim() || null });
      setText("");
    } catch (e) { toast.error(formatErr(e)); }
    finally { setUploading(false); }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => onSend({ type: "location", location: { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "My location" } }),
      () => toast.error("Could not get location")
    );
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimer.current);
        setRecording(false);
        setRecordSec(0);
        if (cancelRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mime });
        await uploadAndSend(file, "audio");
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSec(0);
      recTimer.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch (e) {
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = (cancel = false) => {
    if (!recording || !mediaRef.current) return;
    cancelRef.current = cancel;
    try { mediaRef.current.stop(); } catch {}
  };

  const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="border-t border-aasha-line bg-white px-3 py-3 pr-3 sm:pr-[210px] md:pr-[210px] lg:pr-3" data-testid="composer">
      <div className="flex items-end gap-2 max-w-5xl mx-auto">
        {recording ? (
          <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-aasha-orangeLight rounded-2xl" data-testid="recording-bar">
            <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => stopRecording(true)} data-testid="btn-record-cancel">
              <Trash2 className="w-5 h-5" />
            </Button>
            <span className="w-2.5 h-2.5 rounded-full bg-aasha-orange animate-pulse-dot" />
            <span className="font-mono text-aasha-ink text-sm">Recording {fmtSec(recordSec)}</span>
            <div className="flex-1" />
            <Button onClick={() => stopRecording(false)} className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white h-10 w-10 p-0" data-testid="btn-record-stop">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-aasha-inkSoft hover:text-aasha-orange shrink-0" data-testid="btn-attach">
                  <Paperclip className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => imgRef.current?.click()} data-testid="attach-image">
                  <ImgIcon className="w-4 h-4 mr-2" /> Photo / Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileRef.current?.click()} data-testid="attach-file">
                  <FileText className="w-4 h-4 mr-2" /> Document (pdf, doc, zip, html…)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareLocation} data-testid="attach-location">
                  <MapPin className="w-4 h-4 mr-2" /> Location
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <input ref={imgRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => uploadAndSend(e.target.files?.[0])} />
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => uploadAndSend(e.target.files?.[0])} />

            <div className="flex-1 bg-aasha-bg rounded-2xl border border-aasha-line px-3 py-1.5">
              <Textarea
                data-testid="message-input"
                value={text}
                onChange={(e) => handleType(e.target.value)}
                onKeyDown={onKey}
                placeholder="Type a message…"
                rows={1}
                className="border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1.5 min-h-[36px] max-h-[140px] text-[15px]"
              />
            </div>

            {text.trim() ? (
              <Button
                onClick={sendText}
                disabled={uploading}
                className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white h-11 w-11 p-0 shrink-0"
                data-testid="btn-send"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            ) : (
              <Button
                onClick={startRecording}
                disabled={uploading}
                className="rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white h-11 w-11 p-0 shrink-0"
                data-testid="btn-mic"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
