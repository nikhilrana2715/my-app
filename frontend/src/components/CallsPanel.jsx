import React, { useEffect, useState, useCallback } from "react";
import { api, formatErr } from "@/lib/api";
import { useCall } from "@/lib/call";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Video, RefreshCw } from "lucide-react";
import { formatChatTime } from "@/lib/utils";
import { toast } from "sonner";

function fmtDuration(sec) {
  if (!sec || sec < 1) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function statusInfo(log) {
  // missed = ringing/declined and incoming, completed = answered
  if (log.is_outgoing) {
    if (log.status === "completed") return { icon: PhoneOutgoing, color: "text-aasha-online", label: "Outgoing" };
    if (log.status === "declined") return { icon: PhoneOutgoing, color: "text-aasha-inkMuted", label: "Declined" };
    if (log.status === "missed") return { icon: PhoneOutgoing, color: "text-aasha-inkMuted", label: "Not answered" };
    return { icon: PhoneOutgoing, color: "text-aasha-inkSoft", label: "Outgoing" };
  }
  if (log.status === "completed") return { icon: PhoneIncoming, color: "text-aasha-online", label: "Incoming" };
  if (log.status === "missed") return { icon: PhoneMissed, color: "text-destructive", label: "Missed" };
  if (log.status === "declined") return { icon: PhoneMissed, color: "text-destructive", label: "Declined" };
  return { icon: PhoneIncoming, color: "text-aasha-inkSoft", label: "Incoming" };
}

export default function CallsPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { startCall } = useCall() || {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/calls");
      setLogs(data);
    } catch (e) { toast.error(formatErr(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const callBack = (log, kind) => {
    if (!log.peer?.id) return;
    startCall?.(log.peer, kind || log.kind || "audio");
  };

  return (
    <div className="flex flex-col h-full" data-testid="calls-panel">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-aasha-ink">Recent calls</h2>
        <Button variant="ghost" size="icon" onClick={load} className="rounded-full" data-testid="btn-refresh-calls">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="text-center text-aasha-inkSoft text-sm mt-8">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-aasha-inkSoft text-sm mt-12 px-6">
            No call history yet. Start a 1-on-1 call from any chat using <Phone className="inline w-4 h-4" /> or <Video className="inline w-4 h-4" />.
          </div>
        ) : logs.map((log) => {
          const { icon: Icon, color, label } = statusInfo(log);
          const isVideo = log.kind === "video";
          return (
            <div
              key={log.id}
              data-testid={`call-log-${log.id}`}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 mb-0.5 hover:bg-white/70 transition-all duration-150"
            >
              <UserAvatar user={log.peer} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-aasha-ink truncate">{log.peer?.name || "Unknown"}</div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className={color}>{label}</span>
                  <span className="text-aasha-inkMuted">• {formatChatTime(log.started_at)}</span>
                  {log.duration_sec > 0 && <span className="text-aasha-inkMuted">• {fmtDuration(log.duration_sec)}</span>}
                </div>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => callBack(log, isVideo ? "video" : "audio")}
                className="rounded-full text-aasha-orange hover:bg-aasha-orangeLight"
                data-testid={`btn-call-back-${log.id}`}
                title={isVideo ? "Video call again" : "Call again"}
              >
                {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
