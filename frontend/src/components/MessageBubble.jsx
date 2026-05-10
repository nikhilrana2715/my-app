import React, { useState } from "react";
import { fileUrl, api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Forward, Trash2, Copy, Share2, Download, FileText, MapPin, Check, CheckCheck, MoreVertical } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatTime, bytes, linkify } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

async function downloadFile(fileId, name) {
  try {
    const url = fileUrl(fileId);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name || "file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (e) {
    toast.error("Download failed");
  }
}

function FileCard({ file, isMine }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); downloadFile(file.id, file.name); }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isMine ? "border-white/30 bg-white/15" : "border-aasha-line bg-aasha-sidebar"} min-w-[220px] max-w-[300px] hover:opacity-90 text-left`}
      data-testid={`file-${file.id}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? "bg-white/20" : "bg-white"}`}>
        <FileText className={`w-5 h-5 ${isMine ? "text-white" : "text-aasha-orange"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${isMine ? "text-white" : "text-aasha-ink"}`}>{file.name}</div>
        <div className={`text-xs ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>{bytes(file.size)} • Tap to download</div>
      </div>
      <Download className={`w-4 h-4 ${isMine ? "text-white/90" : "text-aasha-inkSoft"}`} />
    </button>
  );
}

function ImageMsg({ file }) {
  const [open, setOpen] = useState(false);
  const url = fileUrl(file.id);
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="block max-w-[280px] cursor-pointer relative group">
        <img src={url} alt={file.name} className="rounded-xl max-h-80 object-cover w-full" loading="lazy" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadFile(file.id, file.name); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`download-image-${file.id}`}
        >
          <Download className="w-4 h-4 text-white" />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-black/95 border-0">
          <img src={url} alt={file.name} className="w-full h-auto max-h-[80vh] object-contain" />
          <button
            type="button"
            onClick={() => downloadFile(file.id, file.name)}
            className="absolute top-3 right-12 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
          >
            <Download className="w-4 h-4 text-white" />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoMsg({ file }) {
  return (
    <div className="relative group" onClick={(e) => e.stopPropagation()}>
      <video controls src={fileUrl(file.id)} className="rounded-xl max-w-[280px] max-h-80" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); downloadFile(file.id, file.name); }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Download className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}

function AudioMsg({ file, isMine }) {
  return (
    <div className={`px-3 py-2.5 rounded-xl ${isMine ? "bg-white/15" : "bg-white border border-aasha-line"} min-w-[240px]`} onClick={(e) => e.stopPropagation()}>
      <audio controls src={fileUrl(file.id)} className="w-full" />
      <div className="flex items-center justify-between mt-1">
        <div className={`text-xs truncate ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>{file.name}</div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadFile(file.id, file.name); }}
          className={`text-xs flex items-center gap-1 ${isMine ? "text-white/90" : "text-aasha-orange"} hover:underline`}
        >
          <Download className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}

function LocationMsg({ loc, isMine }) {
  if (!loc) return null;
  // Google Maps deep-link
  const url = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  // Static map preview via OpenStreetMap (no API key) — fallback if blocked
  const staticMap = `https://staticmap.openstreetmap.de/staticmap.php?center=${loc.lat},${loc.lng}&zoom=15&size=300x140&markers=${loc.lat},${loc.lng},red-pushpin`;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer"); }}
      className={`block rounded-xl border overflow-hidden ${isMine ? "border-white/30 bg-white/15" : "border-aasha-line bg-aasha-sidebar"} min-w-[220px] max-w-[300px] text-left hover:opacity-90`}
      data-testid="location-card"
    >
      <img src={staticMap} alt="Map" className="w-full h-28 object-cover" onError={(e) => { e.target.style.display = "none"; }} />
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? "bg-white/20" : "bg-white"}`}>
          <MapPin className={`w-5 h-5 ${isMine ? "text-white" : "text-aasha-orange"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${isMine ? "text-white" : "text-aasha-ink"}`}>{loc.label || "Location"}</div>
          <div className={`text-xs ${isMine ? "text-white/80" : "text-aasha-inkSoft"}`}>Tap to open in Google Maps</div>
        </div>
      </div>
    </button>
  );
}

export default function MessageBubble({ msg, isMine, showSenderName, showAvatar, onForward, onDelete, otherMembersCount = 1 }) {
  const { user } = useAuth();
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
  const react = async (emoji) => {
    try { await api.post(`/messages/${msg.id}/react`, { emoji }); }
    catch (e) { toast.error(formatErr(e)); }
  };

  const readers = (msg.read_by || []).filter((u) => u !== msg.sender_id);
  const isRead = isMine && readers.length >= otherMembersCount && otherMembersCount > 0;
  const reactions = msg.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(([, arr]) => arr.length > 0);

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
        <div className="relative">
          <div className={`rounded-2xl ${isMine ? "bg-aasha-orange text-white bubble-tail-right animate-bubble-in-right" : "bg-white text-aasha-ink border border-aasha-line bubble-tail-left animate-bubble-in-left"} px-3 py-2 shadow-sm`}>
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
                    <a key={i} href={p.value} target="_blank" rel="noreferrer" className={`underline ${isMine ? "text-white" : "text-aasha-orange"}`} onClick={(e) => e.stopPropagation()}>{p.value}</a>
                  ) : <span key={i}>{p.value}</span>
                )}
              </div>
            )}
            <div className={`text-[10px] mt-1 ${isMine ? "text-white/80" : "text-aasha-inkMuted"} text-right flex items-center gap-1 justify-end`}>
              <span>{formatTime(msg.created_at)}</span>
              {isMine && (
                isRead
                  ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" data-testid={`tick-read-${msg.id}`} />
                  : readers.length > 0
                    ? <CheckCheck className="w-3.5 h-3.5 text-white/80" data-testid={`tick-delivered-${msg.id}`} />
                    : <Check className="w-3.5 h-3.5 text-white/80" data-testid={`tick-sent-${msg.id}`} />
              )}
            </div>
          </div>
          {/* Dedicated dropdown trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`absolute top-1 ${isMine ? "left-1" : "right-1"} w-7 h-7 rounded-full ${isMine ? "bg-white/15 hover:bg-white/25 text-white" : "bg-aasha-bg hover:bg-aasha-orangeLight text-aasha-inkSoft"} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}
                data-testid={`actions-${msg.id}`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isMine ? "end" : "start"} className="min-w-[200px]">
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                {QUICK_REACTIONS.map((emo) => {
                  const mine = (reactions[emo] || []).includes(user?.id);
                  return (
                    <button
                      key={emo}
                      onClick={() => react(emo)}
                      data-testid={`react-${emo}-${msg.id}`}
                      className={`text-xl w-9 h-9 rounded-full hover:bg-aasha-orangeLight transition-all hover:scale-110 ${mine ? "bg-aasha-orangeLight" : ""}`}
                    >
                      {emo}
                    </button>
                  );
                })}
              </div>
              <DropdownMenuSeparator />
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
              {msg.file && (
                <DropdownMenuItem onClick={() => downloadFile(msg.file.id, msg.file.name)} data-testid={`save-${msg.id}`}>
                  <Download className="w-4 h-4 mr-2" /> Save / Download
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
        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`} data-testid={`reactions-${msg.id}`}>
            {reactionEntries.map(([emo, users]) => {
              const mine = users.includes(user?.id);
              return (
                <button
                  key={emo}
                  onClick={() => react(emo)}
                  className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all hover:scale-105 ${
                    mine ? "bg-aasha-orangeLight border-aasha-orange" : "bg-white border-aasha-line"
                  }`}
                >
                  <span>{emo}</span>
                  <span className="text-aasha-ink font-semibold">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
