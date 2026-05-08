import React from "react";
import { initials } from "@/lib/utils";

export function UserAvatar({ user, size = 40, showOnline = false }) {
  const px = `${size}px`;
  const url = user?.avatar;
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
