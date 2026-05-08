import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("aasha_token");
    if (!token) { setUser(null); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("aasha_token");
      setUser(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = (token, userData) => {
    localStorage.setItem("aasha_token", token);
    setUser(userData);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("aasha_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, login, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
