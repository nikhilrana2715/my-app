import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) { return twMerge(clsx(inputs)); }

export function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatChatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs < dayMs && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffMs < 7 * dayMs) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function bytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "U";
}

const URL_RE = /(https?:\/\/[^\s]+)/g;
export function isLinkOnly(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return URL_RE.test(trimmed) && trimmed.replace(URL_RE, "").trim() === "";
}
export function linkify(text) {
  if (!text) return [];
  const parts = [];
  let lastIdx = 0;
  let m;
  const re = new RegExp(URL_RE);
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push({ type: "text", value: text.slice(lastIdx, m.index) });
    parts.push({ type: "link", value: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push({ type: "text", value: text.slice(lastIdx) });
  return parts;
}
