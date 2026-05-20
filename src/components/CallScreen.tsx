import React, { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, User, Camera } from "lucide-react";

interface CallScreenProps {
  callId: string;
  callerName: string;
  receiverName: string;
  type: "voice" | "video";
  direction: "incoming" | "outgoing";
  onAnswer: () => void;
  onHangup: (duration?: number) => void;
}

export function CallScreen({
  callId,
  callerName,
  receiverName,
  type,
  direction,
  onAnswer,
  onHangup,
}: CallScreenProps) {
  const [status, setStatus] = useState<"ringing" | "connected" | "ended">("ringing");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const ringtoneTimer = useRef<number | null>(null);
  const callDurationTimer = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Synthesized Ringtone Generator using Browser Web Audio API (to avoid loading external audio files)
  const startRingtoneSynth = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const playBeep = () => {
        if (status !== "ringing") return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        // Standard telephone ring frequency pairing
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.8);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);

        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      };

      // Play Beep every 3 seconds
      playBeep();
      const interval = window.setInterval(playBeep, 2500);
      ringtoneTimer.current = interval;
    } catch (e) {
      console.warn("Virtual ringtone failed to start:", e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneTimer.current) {
      clearInterval(ringtoneTimer.current);
      ringtoneTimer.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  // Start Call Timer
  const startCallTimer = () => {
    const interval = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    callDurationTimer.current = interval;
  };

  // Setup Local Stream for video call
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setCameraStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera/Mic stream blocked or unavailable in frame: ", err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // Handle incoming call action
  const handleAnswerClick = () => {
    stopRingtone();
    setStatus("connected");
    onAnswer();
    startCallTimer();
    if (type === "video") {
      startCamera();
    }
  };

  // Handle call wrap up
  const handleHangupClick = () => {
    stopRingtone();
    stopCamera();
    if (callDurationTimer.current) {
      clearInterval(callDurationTimer.current);
    }
    setStatus("ended");
    setTimeout(() => {
      onHangup(duration);
    }, 1000);
  };

  useEffect(() => {
    if (direction === "incoming") {
      startRingtoneSynth();
    } else {
      // Outgoing calls connect instantly in simulation for slick prototyping feel
      setStatus("connected");
      onAnswer();
      startCallTimer();
      if (type === "video") {
        startCamera();
      }
    }

    return () => {
      stopRingtone();
      stopCamera();
      if (callDurationTimer.current) {
        clearInterval(callDurationTimer.current);
      }
    };
  }, []);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div id={`call-screen-${callId}`} className="fixed inset-0 z-50 bg-[#050505] flex flex-col justify-between items-center p-6 text-white font-sans">
      
      {/* Background decoration for Cyberpunk theme */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111111_0%,_#050505_100%)] pointer-events-none z-0" />

      {/* Top Header Information Panel */}
      <div className="w-full max-w-md flex flex-col items-center mt-12 z-10 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00FF9C]/20 bg-[#0A0A0A]/80 text-[#00FF9C] text-xs font-mono tracking-widest mb-6 uppercase">
          <span className="w-2 h-2 rounded-full bg-[#00FF9C] animate-ping" />
          {type === "video" ? "Secure Neon Video" : "Secure Neon Voice"}
        </div>
        
        <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          {direction === "incoming" ? callerName : receiverName}
        </h2>
        
        <p className="text-[#00FF9C] font-mono text-xs tracking-wider uppercase">
          {status === "ringing" ? "Incoming Alert Ring..." : `Session Active • ${formatTimer(duration)}`}
        </p>
      </div>

      {/* Center Media Node (Live camera stream OR nice avatar widget) */}
      <div className="w-full max-w-sm h-72 rounded-2xl relative border-2 border-[#00FF9C]/50 bg-[#0A0A0A] flex items-center justify-center overflow-hidden shadow-[0_0_25px_rgba(0,255,156,0.15)] z-10 my-4">
        {type === "video" && !videoOff && status === "connected" ? (
          <>
            <video
              id="local-video-feed"
              ref={localVideoRef}
              autoPlay
              playsInline
              muted={muted}
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Overlay indicators for premium style */}
            <div className="absolute bottom-3 left-3 bg-[#050505]/80 border border-[#00FF9C]/30 rounded px-2.5 py-0.5 text-xxs font-mono text-white flex items-center gap-1">
              <Camera className="w-3 h-3 text-[#00FF9C]" /> YOUR WEBCAM LIVE
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full border-2 border-[#00FF9C] flex items-center justify-center bg-[#0D0D0D] relative">
              <User className="w-12 h-12 text-[#00FF9C]" />
              {status === "ringing" && (
                <div className="absolute -inset-2.5 rounded-full border border-[#00FF9C] animate-ping opacity-30" />
              )}
            </div>
            {videoOff && type === "video" && (
              <span className="text-gray-500 text-xs font-mono uppercase">Camera Disabled</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Interface Controls Panel */}
      <div className="w-full max-w-md flex flex-col items-center mb-12 z-10">
        
        {/* Secondary feature keys when connected */}
        {status === "connected" && (
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => setMuted(!muted)}
              className={`w-12 h-12 rounded-full border border-gray-750 flex items-center justify-center transition duration-200 ${
                muted ? "bg-[#00FF9C] text-[#050505] border-[#00FF9C]" : "bg-[#0D0D0D] text-gray-300 hover:border-gray-500"
              }`}
            >
              <MicOff className="w-5 h-5" />
            </button>
            
            {type === "video" && (
              <button
                onClick={() => setVideoOff(!videoOff)}
                className={`w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center transition duration-200 ${
                  videoOff ? "bg-[#00FF9C] text-[#050505] border-[#00FF9C]" : "bg-[#0D0D0D] text-gray-300 hover:border-gray-500"
                }`}
              >
                <VideoOff className="w-5 h-5" />
              </button>
            )}

            <div className="w-12 h-12 rounded-full border border-gray-705 bg-[#0D0D0D] flex items-center justify-center text-gray-400">
              <Volume2 className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* Primary Call Acceptance/Hangup Action Paddles */}
        <div className="flex items-center gap-8 w-full justify-center">
          {status === "ringing" && direction === "incoming" && (
            <button
              id="answer-call-btn"
              onClick={handleAnswerClick}
              className="w-16 h-16 rounded-full bg-[#00FF9C] hover:bg-[#00FF9C]/80 shadow-[0_0_20px_rgba(0,255,156,0.4)] flex items-center justify-center text-[#050505] transition-transform duration-200 hover:scale-105"
            >
              <Phone className="w-7 h-7" />
            </button>
          )}

          <button
            id="decline-call-btn"
            onClick={handleHangupClick}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center text-white transition-transform duration-200 hover:scale-105"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
