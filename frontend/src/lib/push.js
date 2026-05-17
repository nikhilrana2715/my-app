import { api } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerPush() {
  if (typeof window === "undefined") return { ok: false, reason: "no-window" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, reason: "not-granted" };
    }
    const { data: keyData } = await api.get("/push/public-key");
    if (!keyData?.public_key) return { ok: false, reason: "no-vapid-key" };
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.public_key),
    });
    const json = sub.toJSON();
    await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "error" };
  }
}

export async function unregisterPush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const sub = await reg?.pushManager?.getSubscription?.();
    if (sub) {
      const json = sub.toJSON();
      try { await api.post("/push/unsubscribe", { endpoint: json.endpoint, keys: json.keys }); } catch {}
      await sub.unsubscribe();
    }
  } catch {}
}
