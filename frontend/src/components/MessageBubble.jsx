import React, { useState } from "react";
import { fileUrl } from "@/lib/api";
import { UserAvatar } from "@/components/UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Forward, Trash2, Copy, Share2, Download, FileText, MapPin, Play } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatTime, bytes, linkify } from "@/lib/utils";
import { toast } from "sonner";

function FileCard({ file, isMine }) {
  const url = fileUrl(file.id);
  return (
    <a href={url} target="_blank" rel="noreferrer" download={file.name}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isMine ? "border-white/30 bg-white/15" : "border-aasha-line bg-aasha-sidebar"} min-w-[220px] max-w-[300px] hover:opacity-90`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? "bg-white/20" : "bg-white"}`}>
        <FileText className={`w-5 h-5 ${isMine ? "text-white" : "text-aasha-orange"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${isMine ? "text-white" : "text-aasha-ink"}`}>{file.name}</div>
        <div className={`text-xs ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>{bytes(file.size)}</div>
      </div>
      <Download className={`w-4 h-4 ${isMine ? "text-white/90" : "text-aasha-inkSoft"}`} />
    </a>
  );
}

function ImageMsg({ file }) {
  const [open, setOpen] = useState(false);
  const url = fileUrl(file.id);
  return (
    <>
      <button onClick={() => setOpen(true)} className="block max-w-[280px]">
        <img src={url} alt={file.name} className="rounded-xl max-h-80 object-cover" loading="lazy" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-black/95 border-0">
          <img src={url} alt={file.name} className="w-full h-auto max-h-[80vh] object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoMsg({ file }) {
  return <video controls src={fileUrl(file.id)} className="rounded-xl max-w-[280px] max-h-80" />;
}

function AudioMsg({ file, isMine }) {
  return (
    <div className={`px-3 py-2.5 rounded-xl ${isMine ? "bg-white/15" : "bg-white border border-aasha-line"} min-w-[240px]`}>
      <audio controls src={fileUrl(file.id)} className="w-full" />
      <div className={`text-xs mt-1 ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>{file.name}</div>
    </div>
  );
}

function LocationMsg({ loc, isMine }) {
  if (!loc) return null;
  const url = `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=15/${loc.lat}/${loc.lng}`;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isMine ? "border-white/30 bg-white/15" : "border-aasha-line bg-aasha-sidebar"} min-w-[220px]`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMine ? "bg-white/20" : "bg-white"}`}>
        <MapPin className={`w-5 h-5 ${isMine ? "text-white" : "text-aasha-orange"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${isMine ? "text-white" : "text-aasha-ink"}`}>{loc.label || "Location"}</div>
        <div className={`text-xs ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>{Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}</div>
      </div>
    </a>
  );
}

export default function MessageBubble({ msg, isMine, showSenderName, showAvatar, onForward, onDelete }) {
  if (msg.deleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1.5`}>
        <div className="text-xs text-aasha-inkMuted italic px-3 py-1.5 bg-aasha-sidebar rounded-full">This message was deleted</div>
      </div>
    );
  }

  const copyText = () => {
    if (msg.text) { navigator.clipboard.writeText(msg.text); toast.success("Copied"); }
  };
  const shareMsg = async () => {
    const text = msg.text || msg.file?.name || "Shared from Aasha";
    if (navigator.share) {
      try { await navigator.share({ text, title: "Aasha" }); } catch {}
    } else {
      navigator.clipboard.writeText(text); toast.success("Copied — paste anywhere to share");
    }
  };

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1.5 group`} data-testid={`msg-${msg.id}`}>
      {!isMine && showAvatar && (
        <div className="mr-2 mt-auto"><UserAvatar user={{ name: msg.sender_name, avatar: msg.sender_avatar }} size={32} /></div>
      )}
      {!isMine && !showAvatar && <div className="w-[40px] shrink-0" />}
      <div className={`max-w-[85%] md:max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
        {showSenderName && (
          <div className="text-[11px] font-semibold text-aasha-orange ml-3 mb-0.5">{msg.sender_name}</div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`rounded-2xl ${isMine ? "bg-aasha-orange text-white bubble-tail-right animate-bubble-in-right" : "bg-white text-aasha-ink border border-aasha-line bubble-tail-left animate-bubble-in-left"} px-3 py-2 text-left shadow-sm`}>
              {msg.forwarded_from && (
                <div className={`text-[11px] italic mb-1 flex items-center gap-1 ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>
                  <Forward className="w-3 h-3" /> Forwarded
                </div>
              )}
              {msg.type === "image" && msg.file && <ImageMsg file={msg.file} />}
              {msg.type === "video" && msg.file && <VideoMsg file={msg.file} />}
              {msg.type === "audio" && msg.file && <AudioMsg file={msg.file} isMine={isMine} />}
              {msg.type === "file" && msg.file && <FileCard file={msg.file} isMine={isMine} />}
              {msg.type === "location" && <LocationMsg loc={msg.location} isMine={isMine} />}
              {(msg.type === "text" || msg.type === "link" || !msg.type) && msg.text && (
                <div className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                  {linkify(msg.text).map((p, i) =>
                    p.type === "link" ? (
                      <a key={i} href={p.value} target="_blank" rel="noreferrer" className={`underline ${isMine ? "text-white" : "text-aasha-orange"}`}>{p.value}</a>
                    ) : <span key={i}>{p.value}</span>
                  )}
                </div>
              )}
              <div className={`text-[10px] mt-1 ${isMine ? "text-white/80" : "text-aasha-inkMuted"} text-right`}>
                {formatTime(msg.created_at)}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isMine ? "end" : "start"}>
            <DropdownMenuItem onClick={() => onForward()} data-testid={`forward-${msg.id}`}>
              <Forward className="w-4 h-4 mr-2" /> Forward
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareMsg}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </DropdownMenuItem>
            {msg.text && (
              <DropdownMenuItem onClick={copyText}>
                <Copy className="w-4 h-4 mr-2" /> Copy
              </DropdownMenuItem>
            )}
            {isMine && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`delete-${msg.id}`}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
