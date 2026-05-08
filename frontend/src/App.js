import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import AuthPage from "@/pages/AuthPage";
import AuthCallback from "@/pages/AuthCallback";
import ChatPage from "@/pages/ChatPage";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import "@/App.css";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aasha-bg">
        <Loader2 className="w-6 h-6 animate-spin text-aasha-orange" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (user) return <Navigate to="/chat" replace />;
  return children;
}

function Router() {
  const location = useLocation();
  // Handle OAuth redirect with hash
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/auth" element={<PublicOnly><AuthPage /></PublicOnly>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/chat" element={<Protected><ChatPage /></Protected>} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Router />
          <Toaster richColors position="top-center" />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
