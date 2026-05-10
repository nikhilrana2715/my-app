import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

const CallCtx = createContext(null);
export const useCall = () => useContext(CallCtx);

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * CallProvider — manages WebRTC peer connection for 1-on-1 audio/video calls.
 * Signaling via the existing app WebSocket. Set window.__aashaSocket from outside
 * (ChatPage) so this context can send WS messages.
 */
export function CallProvider({ children, currentUser }) {
  const [state, setState] = useState({ status: "idle", kind: null, peer: null, mediaError: null });
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const callKindRef = useRef(null);
  const callIdRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const getSocket = () => window.__aashaSocket;

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
    callIdRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCamOff(false);
    setState({ status: "idle", kind: null, peer: null, mediaError: null });
  }, []);

  const ensurePeer = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const peerId = stateRef.current?.peer?.id;
        if (peerId) getSocket()?.send({ type: "call_ice", to: peerId, call_id: callIdRef.current, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
    };
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        endCall(false);
      } else if (pc.connectionState === "connected") {
        setState((s) => ({ ...s, status: "in-call" }));
      }
    };
    pcRef.current = pc;
    return pc;
  }, []);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const acquireMedia = async (kind) => {
    const constraints = kind === "video"
      ? { audio: true, video: { facingMode: "user" } }
      : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const startCall = useCallback(async (peer, kind = "audio") => {
    if (state.status !== "idle") return;
    callKindRef.current = kind;
    const cid = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    callIdRef.current = cid;
    setState({ status: "calling", kind, peer, mediaError: null });
    try {
      const stream = await acquireMedia(kind);
      const pc = ensurePeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      getSocket()?.send({ type: "call_offer", to: peer.id, call_id: cid, kind, sdp: offer });
    } catch (e) {
      toast.error("Could not access mic/camera");
      cleanup();
    }
  }, [state.status, ensurePeer, cleanup]);

  const acceptCall = useCallback(async (offerEvt) => {
    const peer = { id: offerEvt.from, name: offerEvt.from_name, avatar: offerEvt.from_avatar };
    const kind = offerEvt.kind || "audio";
    callKindRef.current = kind;
    callIdRef.current = offerEvt.call_id;
    setState({ status: "in-call", kind, peer, mediaError: null });
    try {
      const stream = await acquireMedia(kind);
      const pc = ensurePeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offerEvt.sdp));
      // Drain pending ICE
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingIceRef.current = [];
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      getSocket()?.send({ type: "call_answer", to: peer.id, call_id: offerEvt.call_id, sdp: ans });
    } catch (e) {
      toast.error("Could not accept call");
      getSocket()?.send({ type: "call_reject", to: peer.id, call_id: offerEvt.call_id });
      cleanup();
    }
  }, [ensurePeer, cleanup]);

  const rejectCall = useCallback((evt) => {
    const peerId = evt?.from || stateRef.current?.peer?.id;
    const cid = evt?.call_id || callIdRef.current;
    if (peerId) getSocket()?.send({ type: "call_reject", to: peerId, call_id: cid });
    cleanup();
  }, [cleanup]);

  const endCall = useCallback((notify = true) => {
    const peerId = stateRef.current?.peer?.id;
    const cid = callIdRef.current;
    if (notify && peerId) getSocket()?.send({ type: "call_end", to: peerId, call_id: cid });
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audio = stream.getAudioTracks()[0];
    if (audio) {
      audio.enabled = !audio.enabled;
      setMuted(!audio.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const v = stream.getVideoTracks()[0];
    if (v) {
      v.enabled = !v.enabled;
      setCamOff(!v.enabled);
    }
  }, []);

  // Handle WebSocket call signals — exposed for ChatPage to forward
  const handleSignal = useCallback(async (evt) => {
    if (!evt || !evt.type?.startsWith("call_")) return;
    if (evt.type === "call_offer") {
      // Incoming call
      if (stateRef.current.status !== "idle") {
        // Busy — auto-reject
        getSocket()?.send({ type: "call_reject", to: evt.from, reason: "busy" });
        return;
      }
      setState({
        status: "incoming",
        kind: evt.kind || "audio",
        peer: { id: evt.from, name: evt.from_name, avatar: evt.from_avatar },
        mediaError: null,
        offer: evt,
      });
    } else if (evt.type === "call_answer") {
      const pc = pcRef.current;
      if (!pc) return;
      try { await pc.setRemoteDescription(new RTCSessionDescription(evt.sdp)); } catch {}
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingIceRef.current = [];
      setState((s) => ({ ...s, status: "in-call" }));
    } else if (evt.type === "call_ice") {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(evt.candidate)); } catch {}
      } else {
        pendingIceRef.current.push(evt.candidate);
      }
    } else if (evt.type === "call_end" || evt.type === "call_reject") {
      toast(evt.type === "call_reject" ? "Call declined" : "Call ended");
      cleanup();
    }
  }, [cleanup]);

  return (
    <CallCtx.Provider value={{
      state, localStream, remoteStream, muted, camOff,
      startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCam, handleSignal,
    }}>
      {children}
    </CallCtx.Provider>
  );
}
