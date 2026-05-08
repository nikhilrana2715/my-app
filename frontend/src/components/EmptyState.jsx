import React from "react";
import { Sparkles } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-8 chat-bg">
      <div className="relative">
        <img
          src="https://images.unsplash.com/photo-1776993800059-3c9adeb67c19?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"
          alt=""
          className="w-72 h-72 rounded-3xl object-cover opacity-80 shadow-sm"
        />
        <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-2xl bg-aasha-orange flex items-center justify-center shadow-lg">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
      </div>
      <h2 className="font-display font-bold text-3xl text-aasha-ink mt-8">Welcome to Aasha</h2>
      <p className="text-aasha-inkSoft mt-2 max-w-md">
        Send messages, photos, videos, audio, files, links, and locations — to friends, family, or groups. Pick a chat or start a new one.
      </p>
    </div>
  );
}
