import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aasha_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function fileUrl(fileId) {
  const token = localStorage.getItem("aasha_token");
  return `${API}/files/${fileId}?auth=${encodeURIComponent(token || "")}`;
}

export function wsUrl() {
  const token = localStorage.getItem("aasha_token");
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/api/ws?token=${encodeURIComponent(token || "")}`;
}

export function formatErr(e) {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  return JSON.stringify(d);
}
