import { wsUrl } from "./api";

export class ChatSocket {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.alive = false;
    this.reconnectTimer = null;
    this.pingTimer = null;
  }
  connect() {
    if (this.ws) return;
    try {
      this.ws = new WebSocket(wsUrl());
    } catch (e) { return; }
    this.ws.onopen = () => {
      this.alive = true;
      this.handlers.onOpen?.();
      this.pingTimer = setInterval(() => {
        try { this.ws.send(JSON.stringify({ type: "ping" })); } catch {}
      }, 25000);
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handlers.onMessage?.(data);
      } catch {}
    };
    this.ws.onclose = () => {
      this.alive = false;
      clearInterval(this.pingTimer);
      this.ws = null;
      this.handlers.onClose?.();
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
    this.ws.onerror = () => { try { this.ws?.close(); } catch {} };
  }
  send(obj) { try { this.ws?.send(JSON.stringify(obj)); } catch {} }
  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}
