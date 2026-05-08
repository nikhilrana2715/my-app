import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, BACKEND_URL, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Sparkles } from "lucide-react";

export default function AuthPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("email");
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submitEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const { data } = await api.post(url, body);
      login(data.token, data.user);
      toast.success(`Welcome${data.user.name ? `, ${data.user.name}` : ""}!`);
      nav("/chat");
    } catch (err) { toast.error(formatErr(err)); }
    finally { setLoading(false); }
  };

  const sendOtp = async () => {
    if (!phone.trim()) return toast.error("Enter phone number");
    setLoading(true);
    try {
      await api.post("/auth/otp/send", { phone });
      setOtpSent(true);
      toast.success("OTP sent — enter any 6-digit code (mock)");
    } catch (err) { toast.error(formatErr(err)); }
    finally { setLoading(false); }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone, otp, name: name || undefined });
      login(data.token, data.user);
      toast.success("Logged in!");
      nav("/chat");
    } catch (err) { toast.error(formatErr(err)); }
    finally { setLoading(false); }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirect = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left visual */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1773083405725-721c720ab2de?crop=entropy&cs=srgb&fm=jpg&w=1400&q=70"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-aasha-orange/40 via-transparent to-black/30" />
        <div className="relative z-10 p-12 flex flex-col justify-end text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-white/95 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-aasha-orange" />
            </div>
            <span className="font-display font-bold text-2xl">Aasha</span>
          </div>
          <h1 className="font-display font-bold text-4xl lg:text-5xl tracking-tight leading-[1.05] max-w-md">
            Light, warm, and ready when you are.
          </h1>
          <p className="mt-4 text-white/90 max-w-md">
            Send messages, photos, videos, audio, files, and locations — to friends, family, or groups.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-aasha-bg">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-2xl bg-aasha-orange flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-xl">Aasha</span>
          </div>
          <h2 className="font-display font-bold text-3xl text-aasha-ink">Welcome back</h2>
          <p className="text-aasha-inkSoft mt-1 mb-6">Choose how you'd like to continue.</p>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full bg-white border" data-testid="auth-tabs">
              <TabsTrigger value="email" data-testid="tab-email"><Mail className="w-4 h-4 mr-1" />Email</TabsTrigger>
              <TabsTrigger value="phone" data-testid="tab-phone"><Phone className="w-4 h-4 mr-1" />Phone</TabsTrigger>
              <TabsTrigger value="google" data-testid="tab-google">Google</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-5">
              <form onSubmit={submitEmail} className="space-y-3" data-testid="email-form">
                {mode === "register" && (
                  <div>
                    <Label>Name</Label>
                    <Input data-testid="input-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aasha User" required />
                  </div>
                )}
                <div>
                  <Label>Email</Label>
                  <Input data-testid="input-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input data-testid="input-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" data-testid="btn-email-submit" disabled={loading} className="w-full rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white font-semibold h-11">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mode === "login" ? "Sign in" : "Create account"}
                </Button>
                <div className="text-center text-sm text-aasha-inkSoft">
                  {mode === "login" ? (
                    <>New to Aasha? <button type="button" data-testid="link-register" className="text-aasha-orange font-semibold" onClick={() => setMode("register")}>Create an account</button></>
                  ) : (
                    <>Already have an account? <button type="button" data-testid="link-login" className="text-aasha-orange font-semibold" onClick={() => setMode("login")}>Sign in</button></>
                  )}
                </div>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="mt-5">
              <form onSubmit={otpSent ? verifyOtp : (e) => { e.preventDefault(); sendOtp(); }} className="space-y-3" data-testid="phone-form">
                <div>
                  <Label>Phone number</Label>
                  <Input data-testid="input-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 90000 00000" required disabled={otpSent} />
                </div>
                {otpSent && (
                  <>
                    <div>
                      <Label>One-time code (any 6 digits)</Label>
                      <Input data-testid="input-otp" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" required />
                    </div>
                    <div>
                      <Label>Display name (optional)</Label>
                      <Input data-testid="input-otp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                    </div>
                  </>
                )}
                <Button type="submit" data-testid="btn-phone-submit" disabled={loading} className="w-full rounded-full bg-aasha-orange hover:bg-aasha-orangeHover text-white font-semibold h-11">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {otpSent ? "Verify & continue" : "Send OTP"}
                </Button>
                {otpSent && (
                  <button type="button" data-testid="btn-otp-change" onClick={() => { setOtpSent(false); setOtp(""); }} className="text-sm text-aasha-inkSoft hover:text-aasha-ink mx-auto block">
                    Change number
                  </button>
                )}
              </form>
            </TabsContent>

            <TabsContent value="google" className="mt-5">
              <div className="text-aasha-inkSoft text-sm mb-4">
                Sign in with your Google account through the secure Emergent flow.
              </div>
              <Button data-testid="btn-google" onClick={googleLogin} className="w-full rounded-full bg-white hover:bg-aasha-bg border text-aasha-ink h-11 font-semibold">
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                Continue with Google
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
