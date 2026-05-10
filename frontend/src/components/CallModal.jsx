import React, { useEffect, useRef } from "react";
import { useCall } from "@/lib/call";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, PhoneIncoming } from "lucide-react";

export default function CallModal() {
  const { state, localStream, remoteStream, muted, camOff,
    acceptCall, rejectCall, endCall, toggleMute, toggleCam } = useCall();
  const localVidRef = useRef(null);
  const remoteVidRef = useRef(null);
  const remoteAudRef = useRef(null);

  useEffect(() => {
    if (localVidRef.current && localStream) localVidRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVidRef.current && remoteStream) remoteVidRef.current.srcObject = remoteStream;
    if (remoteAudRef.current && remoteStream) remoteAudRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (state.status === "idle") return null;

  const isIncoming = state.status === "incoming";
  const isCalling = state.status === "calling";
  const inCall = state.status === "in-call";
  const isVideo = state.kind === "video";

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center px-4" data-testid="call-modal">
      {/* Remote video / avatar */}
      <div className="relative w-full max-w-2xl flex-1 flex items-center justify-center">
        {isVideo && remoteStream ? (
          <video ref={remoteVidRef} autoPlay playsInline className="w-full h-full max-h-[70vh] rounded-2xl object-cover bg-black" />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <UserAvatar user={state.peer} size={140} />
            <div className="text-white font-display font-bold text-3xl">{state.peer?.name}</div>
            <div className="text-white/70 text-sm">
              {isIncoming && <span className="flex items-center gap-2"><PhoneIncoming className="w-4 h-4 animate-pulse" /> Incoming {state.kind} call…</span>}
              {isCalling && "Calling…"}
              {inCall && (isVideo ? "Connected" : "On call")}
            </div>
          </div>
        )}
      </div>

      {/* Local video preview */}
      {isVideo && localStream && (
        <video ref={localVidRef} autoPlay playsInline muted
               className="absolute top-4 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-xl object-cover border-2 border-white/20 shadow-lg" />
      )}

      {/* Hidden remote audio for audio-only calls */}
      {!isVideo && <audio ref={remoteAudRef} autoPlay />}

      {/* Controls */}
      <div className="flex items-center gap-4 pb-8 pt-4">
        {isIncoming ? (
          <>
            <Button onClick={() => rejectCall(state.offer)} className="rounded-full bg-red-600 hover:bg-red-700 w-14 h-14 p-0" data-testid="btn-call-reject">
              <PhoneOff className="w-6 h-6 text-white" />
            </Button>
            <Button onClick={() => acceptCall(state.offer)} className="rounded-full bg-green-600 hover:bg-green-700 w-14 h-14 p-0" data-testid="btn-call-accept">
              <Phone className="w-6 h-6 text-white" />
            </Button>
          </>
        ) : (
          <>
            <Button onClick={toggleMute} className={`rounded-full w-12 h-12 p-0 ${muted ? "bg-red-600 hover:bg-red-700" : "bg-white/15 hover:bg-white/25"}`} data-testid="btn-call-mute">
              {muted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </Button>
            {isVideo && (
              <Button onClick={toggleCam} className={`rounded-full w-12 h-12 p-0 ${camOff ? "bg-red-600 hover:bg-red-700" : "bg-white/15 hover:bg-white/25"}`} data-testid="btn-call-cam">
                {camOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
              </Button>
            )}
            <Button onClick={() => endCall(true)} className="rounded-full bg-red-600 hover:bg-red-700 w-14 h-14 p-0" data-testid="btn-call-end">
              <PhoneOff className="w-6 h-6 text-white" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
