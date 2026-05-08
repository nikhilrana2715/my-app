import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const { login } = useAuth();
  const nav = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/auth"); return; }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        login(data.token, data.user);
        toast.success(`Welcome, ${data.user.name}!`);
        // clean url
        window.history.replaceState({}, "", "/chat");
        nav("/chat", { replace: true });
      } catch (e) {
        toast.error(formatErr(e));
        nav("/auth", { replace: true });
      }
    })();
  }, [login, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-aasha-bg">
      <div className="flex items-center gap-3 text-aasha-inkSoft">
        <Loader2 className="w-5 h-5 animate-spin" /> Signing you in…
      </div>
    </div>
  );
}
