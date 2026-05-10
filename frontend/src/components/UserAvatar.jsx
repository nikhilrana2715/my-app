import React from "react";
import { initials } from "@/lib/utils";

export function UserAvatar({ user, size = 40, showOnline = false }) {
  const px = `${size}px`;
  let url = user?.avatar;
  // Resolve internal aasha file references to authenticated download URL
  if (url && typeof url === "string" && url.startsWith("aasha-file://")) {
    const id = url.replace("aasha-file://", "");
    const token = (typeof window !== "undefined") ? window.localStorage.getItem("aasha_token") : null;
    const base = process.env.REACT_APP_BACKEND_URL;
    url = token && base ? `${base}/api/files/${id}?auth=${encodeURIComponent(token)}` : null;
  }
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }} data-testid="user-avatar">
      {url ? (
        <img src={url} alt={user?.name || ""} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-display font-bold text-white"
          style={{
            width: px, height: px,
            background: `linear-gradient(135deg, #F26C4F, #E58044)`,
            fontSize: `${Math.max(12, size / 2.6)}px`,
          }}
        >
          {initials(user?.name)}
        </div>
      )}
      {showOnline && user?.online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-aasha-online ring-2 ring-white"
          style={{ width: Math.max(10, size / 4), height: Math.max(10, size / 4) }}
        />
      )}
    </div>
  );
}
