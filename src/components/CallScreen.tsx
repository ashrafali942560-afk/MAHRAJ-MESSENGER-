import React, { useState, useEffect, useRef } from "react";
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Volume2, 
  User, 
  Camera, 
  Sparkles,
  Keyboard,
  Send,
  Lock,
  UserPlus,
  ChevronLeft,
  Search,
  Check,
  VolumeX,
  Volume1,
  Maximize2,
  Grid
} from "lucide-react";
import { listenCall } from "../lib/state";

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

  // Advanced Interactive Call states
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isGridView, setIsGridView] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [hudMessage, setHudMessage] = useState<string | null>(null);

  // Waveform state ticks for sound animation
  const [vibeTicks, setVibeTicks] = useState(0);

  // Dynamic Grid Participant instances conforming to the screenshot
  const [participants, setParticipants] = useState<Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    colorClass: string; // text/border color representation in theme
    borderColor: string;
    textColor: string;
    isSpeaking: boolean;
    isYou: boolean;
  }>>([
    {
      id: "guest1",
      name: "+1",
      borderColor: "border-[#f9b115]", // Solid yellow from grid mockup
      textColor: "text-[#f9b115]",
      colorClass: "#f9b115",
      isSpeaking: true,
      isYou: false
    },
    {
      id: "you",
      name: "You",
      borderColor: "border-[#00e3f2]", // Solid cyan from grid mockup
      textColor: "text-[#00e3f2]",
      colorClass: "#00e3f2",
      isSpeaking: true,
      isYou: true
    }
  ]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const ringtoneTimer = useRef<number | null>(null);
  const callDurationTimer = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // AI Voice Assistant Specific States
  const isAiCall = receiverName === "MAHRAJ HELP" || callerName === "MAHRAJ HELP" || callId.includes("ai-bot") || receiverName === "ai-bot";
  const [transcript, setTranscript] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Initializing secure voice links..." }
  ]);
  const [voiceActivated, setVoiceActivated] = useState(true);
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [fallbackTextInput, setFallbackTextInput] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);

  // Users lookup for Dialer list
  const [dialerContacts, setDialerContacts] = useState<any[]>([]);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);
  const lastUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load contacts list from LocalStorage for high-fidelity interactive user selection
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem("mahraj_messenger_users") || "[]";
      const list = JSON.parse(storedUsers);
      if (Array.isArray(list)) {
        // Filter out helper bots or active caller to avoid redundancy
        setDialerContacts(list.filter(u => u.uid !== "ai-bot" && u.uid !== "ai-bot_user_YXJzaGFuYW"));
      }
    } catch (e) {
      console.warn("Could not load contacts inside Dialer drawer", e);
    }
  }, []);

  // Set up fluctuating tick cycles for dynamic speech waveform animations (peaks bounce synchronously)
  useEffect(() => {
    let interval: any;
    if (status === "connected") {
      interval = setInterval(() => {
        setVibeTicks(prev => prev + 1);
      }, 120);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Helper flash HUD notification
  const triggerHUD = (msg: string) => {
    setHudMessage(msg);
    const audioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (audioContextClass) {
      try {
        const ctx = new audioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch (e) {}
    }
    setTimeout(() => setHudMessage(null), 2500);
  };

  // Synthesized Ringtone Generator using Browser Web Audio API
  const startRingtoneSynth = (isOutgoing = false) => {
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

        if (isOutgoing) {
          osc.type = "sine";
          osc.frequency.setValueAtTime(425, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.08, ctx.currentTime + 1.2);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.3);
          osc.start();
          osc.stop(ctx.currentTime + 1.5);
        } else {
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + 0.8);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);
          osc.start();
          osc.stop(ctx.currentTime + 1.2);
        }
      };

      playBeep();
      const interval = window.setInterval(playBeep, isOutgoing ? 4000 : 2500);
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

  const startCallTimer = () => {
    if (callDurationTimer.current) {
      clearInterval(callDurationTimer.current);
    }
    const interval = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    callDurationTimer.current = interval;
  };

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
      console.warn("Camera/Mic stream blocked or unavailable: ", err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleAnswerClick = () => {
    stopRingtone();
    setStatus("connected");
    onAnswer();
    startCallTimer();
    if (type === "video" && !isAiCall) {
      startCamera();
    }
    triggerHUD("SECURE HANDSHAKE LINK ESTABLISHED");
  };

  const handleHangupClick = () => {
    stopRingtone();
    stopCamera();
    if (callDurationTimer.current) {
      clearInterval(callDurationTimer.current);
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    setStatus("ended");
    setTimeout(() => {
      onHangup(duration);
    }, 1000);
  };

  // Web Speech Synthesis (Text-to-Speech)
  const speakOutLoud = (text: string) => {
    if (!synthRef.current) return;

    // Immediately cancel any current speaking voice
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose natural English voice if possible
    const voices = synthRef.current.getVoices();
    const voice = voices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) || 
                  voices.find(v => v.lang.startsWith("en-")) || 
                  voices[0];
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 1.05; // Slightly faster for responsiveness

    utterance.onstart = () => {
      setAiSpeaking(true);
      // Stop listening while AI speaks to prevent feedback echo loops
      if (recognitionRef.current && recognitionActive) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };

    utterance.onend = () => {
      setAiSpeaking(false);
      // Resume listening once AI is finished
      if (voiceActivated && status === "connected" && recognitionRef.current && !recognitionActive) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error: ", e);
      setAiSpeaking(false);
    };

    lastUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  // Interruption Handling (Rule 4: Stop talking immediately if user wants to speak or skip)
  const handleInterruptAI = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setAiSpeaking(false);
    // Force speech recognition to wake up
    if (voiceActivated && recognitionRef.current && !recognitionActive) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  // AI Voice Activation listener
  const handleSendUserSpeech = async (text: string) => {
    if (!text.trim()) return;

    // Add immediate feedback
    const userMsg = { sender: "user" as const, text };
    setTranscript(prev => [...prev, userMsg]);
    setApiLoading(true);

    try {
      const localHistory = [
        ...transcript,
        userMsg
      ].map(m => ({
        senderId: m.sender === "user" ? "user" : "ai-bot",
        text: m.text
      }));

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: localHistory,
          isVoiceCall: true
        })
      });

      const data = await response.json();
      setApiLoading(false);

      if (data && data.text) {
        const aiResponseText = data.text;
        setTranscript(prev => [...prev, { sender: "ai", text: aiResponseText }]);
        speakOutLoud(aiResponseText);
      } else {
        const errorMsg = "I am sorry, my neural pathways did not respond. Could you state that once more?";
        setTranscript(prev => [...prev, { sender: "ai", text: errorMsg }]);
        speakOutLoud(errorMsg);
      }
    } catch (e) {
      console.error("AI Assistant transmission crash: ", e);
      setApiLoading(false);
      const offlineMsg = "The server is offline. Please check your internet connection or configure an API key in settings.";
      setTranscript(prev => [...prev, { sender: "ai", text: offlineMsg }]);
      speakOutLoud(offlineMsg);
    }
  };

  const handleKeyboardSendSubmit = () => {
    if (!fallbackTextInput.trim()) return;
    const txt = fallbackTextInput;
    setFallbackTextInput("");
    if (aiSpeaking) {
      handleInterruptAI();
    }
    handleSendUserSpeech(txt);
  };

  // Ringtone and call sync listeners
  useEffect(() => {
    const isOutgoing = direction === "outgoing";
    startRingtoneSynth(isOutgoing);

    // AI voice assistant auto-answers instantly (outgoing call simulation)
    if (isAiCall && isOutgoing) {
      const waitTimer = setTimeout(() => {
        handleAnswerClick();
      }, 1500);

      return () => {
        clearTimeout(waitTimer);
        stopRingtone();
      };
    }

    const unsubscribe = listenCall(callId, (updatedCall) => {
      if (updatedCall.status === "connected") {
        stopRingtone();
        setStatus("connected");
        startCallTimer();
        if (type === "video" && !cameraStream && !isAiCall) {
          startCamera();
        }
      } else if (updatedCall.status === "completed" || updatedCall.status === "declined" || updatedCall.status === "missed") {
        stopRingtone();
        stopCamera();
        if (callDurationTimer.current) {
          clearInterval(callDurationTimer.current);
        }
        if (synthRef.current) {
          synthRef.current.cancel();
        }
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {}
        }
        setStatus("ended");
        setTimeout(() => {
          onHangup(updatedCall.duration || duration);
        }, 1200);
      }
    });

    return () => {
      unsubscribe();
      stopRingtone();
      stopCamera();
      if (callDurationTimer.current) {
        clearInterval(callDurationTimer.current);
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [callId, direction, type, cameraStream]);

  // Warm Greeting on First Call Connection (Rule 6)
  useEffect(() => {
    if (isAiCall && status === "connected") {
      const greetingText = "Alright, let us do it! I am Mahraj, your high speed voice coordinator for Mahraj Messenger. What is on your mind today, and how can I help you?";
      setTranscript([
        { sender: "ai", text: greetingText }
      ]);
      const t = setTimeout(() => {
        speakOutLoud(greetingText);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isAiCall, status]);

  // Web SpeechRecognition (Speech-to-Text) Controller Loop
  useEffect(() => {
    if (!isAiCall || status !== "connected" || muted || !voiceActivated) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const rec = new SpeechRecognitionClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setRecognitionActive(true);
      };

      rec.onend = () => {
        setRecognitionActive(false);
        // Restart recording loop if state remains true and assistant isn't speaking
        if (voiceActivated && !aiSpeaking && !muted && status === "connected") {
          try {
            rec.start();
          } catch (e) {}
        }
      };

      rec.onresult = async (event: any) => {
        const spokenText = event.results[event.results.length - 1][0].transcript;
        if (spokenText && spokenText.trim()) {
          // Rule 4: If AI was speaking, interrupt immediately
          if (aiSpeaking) {
            handleInterruptAI();
          }
          await handleSendUserSpeech(spokenText);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("Speech recognition error loop: ", e.error);
        if (e.error === "not-allowed") {
          setVoiceActivated(false);
        }
      };

      recognitionRef.current = rec;

      if (!aiSpeaking && !muted) {
        try {
          rec.start();
        } catch (e) {}
      }
    } else {
      console.warn("Speech recognition is not supported in this environment.");
      setVoiceActivated(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [isAiCall, status, muted, voiceActivated, aiSpeaking]);

  // Long-format timer representation e.g. 01:57:24 matching left side phone of screenshot
  const formatTimerLong = (secs: number) => {
    if (status === "ringing") return "00:00:00";
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Soundwave generator heights returning exact random values relative to indices
  const getDynamicWaveHeight = (index: number) => {
    if (status !== "connected") return "4px";
    if (muted && index > 1) return "2px";
    const sinValue = Math.sin((vibeTicks + index) * 0.95) * 12 + 15;
    const fuzz = Math.random() * 8;
    return `${Math.max(2, Math.min(32, sinValue + fuzz))}px`;
  };

  return (
    <div id={`call-screen-${callId}`} className="fixed inset-0 z-50 bg-[#070708] flex flex-col justify-between items-center text-white font-sans overflow-hidden select-none">
      
      {/* Background radial secure neon aura */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0b161c_0%,_#05080b_100%)] pointer-events-none z-0" />

      {/* Dynamic HUD Indicator Alert overlay */}
      {hudMessage && (
        <div className="absolute top-20 z-50 bg-[#00FF9C]/10 border border-[#00FF9C]/40 text-[#00FF9C] font-mono text-xxs tracking-widest px-4 py-2 rounded-full uppercase shadow-[0_0_15px_rgba(0,255,156,0.3)] animate-bounce select-none">
          ⚡ {hudMessage}
        </div>
      )}

      {/* Top Navigation Bar with encryption lock and participants dial triggers */}
      <div className="w-full px-5 py-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/40 to-transparent relative shrink-0">
        <button 
          onClick={handleHangupClick}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
          title="Minimize call"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/5 bg-black/45 text-gray-300 text-[11px] font-sans tracking-tight font-medium">
          <Lock className="w-3.5 h-3.5 text-gray-400 stroke-[2.5]" />
          <span>End-To-End Encrypted</span>
        </div>

        <div className="flex items-center gap-2">
          {status === "connected" && (
            <button
              onClick={() => {
                setIsGridView(p => !p);
                triggerHUD(isGridView ? "SOLO DECRYPTION ACTIVE" : "MULTI-PARTY PROTOCOL ESTABLISHED");
              }}
              className={`p-1.5 border rounded-lg transition cursor-pointer text-xs font-mono font-bold flex items-center justify-center ${
                isGridView 
                  ? "bg-[#00FF9C]/10 text-[#00FF9C] border-[#00FF9C]/30" 
                  : "bg-transparent text-gray-400 border-white/15 hover:text-white"
              }`}
              title="Toggle Multi-Party Grid View Mode"
            >
              <Grid className="w-4 h-4 mr-1" />
              <span>Grid</span>
            </button>
          )}

          <button
            onClick={() => {
              if (status !== "connected") {
                triggerHUD("AWAITING ACTIVE VOICE CONNECTION");
              } else {
                setShowAddContactModal(true);
              }
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer relative"
            title="Invite Participant to Call"
          >
            <UserPlus className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00FF9C] animate-ping border border-black" />
          </button>
        </div>
      </div>

      {/* Main Screen Content Frame */}
      <div className="w-full flex-1 flex flex-col items-center justify-center px-4 relative z-10 overflow-hidden">
        
        {/* VIEW 1: Solo Contact Call Screen representing Left Phone */}
        {!isGridView && (
          <div className="w-full max-w-sm flex flex-col items-center justify-between py-6 h-full max-h-[460px] animate-fade-in relative z-10 select-none">
            
            <div className="text-center space-y-2 mt-4">
              <h2 className="text-3xl font-bold tracking-wide text-white font-sans">
                {isAiCall ? "MAHRAJ AI ASSISTANT" : (direction === "incoming" ? callerName : receiverName)}
              </h2>
              <div className="text-gray-400 font-mono text-[16px] tracking-widest font-semibold flex items-center justify-center gap-2">
                <span>{formatTimerLong(duration)}</span>
              </div>
              {status === "ringing" && (
                <p className="text-[#00FF9C] font-mono text-[10px] uppercase tracking-widest animate-pulse mt-1">
                  🎛️ INCOMING SECURED LINK ALERT...
                </p>
              )}
            </div>

            {/* Elite Circular profile frame with pulsating energy */}
            <div className="relative my-8 flex items-center justify-center">
              {status === "connected" && (
                <>
                  <div className="absolute w-48 h-48 rounded-full bg-[#00FF9C]/5 border border-[#00FF9C]/10 animate-ping opacity-30" style={{ animationDuration: '3s' }} />
                  <div className="absolute w-40 h-40 rounded-full bg-[#00FF9C]/5 border border-[#00FF9C]/20 animate-pulse opacity-40" />
                </>
              )}
              <div className="w-36 h-36 rounded-full border-[3px] border-white/15 bg-neutral-900/90 flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <User className="w-16 h-16 text-white/80" />
                {isAiCall && (
                  <div className="absolute inset-0 bg-gradient-to-t from-[#00FF9C]/20 to-transparent flex items-end justify-center pb-2">
                    <Sparkles className="w-4 h-4 text-[#00FF9C] animate-bounce" />
                  </div>
                )}
              </div>
            </div>

            {/* AI Call transcription sidebar hint */}
            {isAiCall && status === "connected" && (
              <div className="w-full bg-black/45 border border-white/5 rounded-2xl p-3 flex flex-col justify-between max-h-36 overflow-y-auto scrollbar-thin text-xxs font-mono text-[#00FF9C]/90">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5">AI VOICE INTERACTION FEED</div>
                {transcript.slice(-2).map((tr, idx) => (
                  <p key={idx} className="leading-relaxed mb-1 truncate">
                    <span className="text-gray-400 font-bold">{tr.sender.toUpperCase()}:</span> {tr.text}
                  </p>
                ))}
              </div>
            )}

            {/* Secure tag */}
            <div className="text-center font-mono text-[8.5px] tracking-widest text-[#00FF9C] uppercase bg-[#00FF9C]/5 border border-[#00FF9C]/20 px-3.5 py-1 rounded-full">
              ⚡ SIGNAL PACKET DECRYPTION: ACTIVE
            </div>
          </div>
        )}

        {/* VIEW 2: Ultra High Fidelity Grid Call Layout representing Right Phone */}
        {isGridView && (
          <div className="w-full max-w-sm h-full max-h-[460px] grid grid-cols-1 gap-4 justify-center items-center py-4 animate-in fade-in zoom-in-95 duration-200">
            {participants.map((p, idx) => {
              // Modulate speaks logic differently to make it look active
              const isActiveSpeaker = p.isSpeaking && !muted;
              
              return (
                <div 
                  key={p.id}
                  className={`relative w-full h-[185px] rounded-3xl border-2 bg-[#121417]/95 flex flex-col justify-between p-4.5 transition-all duration-300 shadow-2xl overflow-hidden ${
                    isActiveSpeaker ? `${p.borderColor} shadow-[0_0_20px_rgba(0,227,242,0.06)] scale-[1.01]` : "border-white/5 bg-[#0e1012]"
                  }`}
                >
                  {/* Participant Badge overlay */}
                  <div className="flex items-center justify-between w-full relative z-10">
                    <span className={`text-base font-bold font-mono tracking-wider ${p.textColor}`}>
                      {p.name}
                    </span>
                    {isActiveSpeaker && (
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                      </span>
                    )}
                  </div>

                  {/* Inside Card Footer: Avatar on Bottom-left + Soundwave lines on Bottom-right */}
                  <div className="flex items-end justify-between w-full mt-auto relative z-10">
                    {/* Circle Avatar (Bottom Left) */}
                    <div className="w-11 h-11 rounded-full bg-neutral-800 border border-white/20 flex items-center justify-center relative shadow-md">
                      <User className="w-5 h-5 text-gray-400" />
                      {p.isYou && type === "video" && !videoOff && (
                        <div className="absolute inset-0 rounded-full border border-[#00FF9C] bg-black/80 flex items-center justify-center text-[8px] text-[#00FF9C] font-bold">CAM</div>
                      )}
                    </div>

                    {/* Highly Polished Yellow & Cyan soundwave visualizers (Bottom Right) */}
                    <div className="flex items-end gap-[2px] h-9 pr-2 shrink-0">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((itemIndex) => (
                        <div 
                          key={itemIndex}
                          className="w-[3px] rounded-full transition-all duration-120"
                          style={{
                            height: getDynamicWaveHeight(itemIndex),
                            backgroundColor: p.colorClass,
                            opacity: isActiveSpeaker ? (itemIndex % 2 === 0 ? 0.95 : 0.70) : 0.20
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Background grid texture lines */}
                  <div className="absolute inset-x-0 bottom-0 top-12 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Auxiliary text overlay fallback controller */}
      {showKeyboard && isAiCall && status === "connected" && (
        <div className="w-full max-w-sm flex items-center gap-1.5 bg-[#0b0e11] border border-white/5 rounded-2xl p-2 z-30 mb-2 shrink-0 px-4 animate-in slide-in-from-bottom duration-100">
          <input 
            type="text" 
            placeholder="Broadcast voice parameter payload..."
            className="flex-1 text-xs bg-neutral-900/90 border border-white/15 text-white rounded-xl px-3 py-2.5 outline-none focus:border-[#00FF9C] font-mono"
            value={fallbackTextInput}
            onChange={(e) => setFallbackTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleKeyboardSendSubmit()}
          />
          <button 
            onClick={handleKeyboardSendSubmit}
            className="p-2.5 rounded-xl bg-[#00FF9C] text-black hover:opacity-90 transition cursor-pointer flex items-center justify-center shadow-lg"
          >
            <Send className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      )}

      {/* Signature Control Doc tray bar at the bottom representing matching Screenshot perfectly */}
      <div className="w-full bg-[#101214] rounded-t-[36px] border-t border-white/5 pb-8 pt-7 px-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] flex flex-col items-center shrink-0">
        
        {/* Quick HUD feedback line */}
        <div className="text-[9px] font-mono tracking-widest text-[#00FF9C]/60 mb-5 text-center uppercase">
          SECURE CHANNEL ID: {callId.slice(0, 16)} • SPEAKERS AMPLIFIED
        </div>

        {/* Dynamic button control dock row */}
        <div className="flex items-center justify-between w-full max-w-xs px-2">
          
          {/* Item 1: Speakerphone button (White button with dark volume icon) */}
          <button
            onClick={() => {
              setIsSpeakerOn(p => !p);
              triggerHUD(!isSpeakerOn ? "HIGH POWER SPEAKER LIVE" : "SPEAKER GAIN DAMPED TO EARPIECE");
            }}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
              isSpeakerOn
                ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
            title="Toggle earpiece / master loudspeaker speaker"
          >
            {isSpeakerOn ? (
              <Volume2 className="w-5.5 h-5.5 stroke-[2.5]" />
            ) : (
              <VolumeX className="w-5.5 h-5.5 text-gray-400" />
            )}
          </button>

          {/* Item 2: Video Camera Toggle (Grey circle shape with white icon inside) */}
          <button
            onClick={() => {
              if (type !== "video") {
                triggerHUD("UPGRADING NETWORK CARRIER PROTOCOL FOR VIDEO...");
                setTimeout(() => {
                  triggerHUD("VIDEO UPGRADE COMMITTED successfully");
                }, 1000);
              }
              setVideoOff(p => !p);
              triggerHUD(videoOff ? "CAMERA STREAM FEED RESTORED" : "CAMERA LENS SHUTTER DEACTIVATED");
            }}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
              videoOff 
                ? "bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/40" 
                : "bg-[#2a2a2c] text-white hover:bg-[#38383a]"
            }`}
            title="Lens toggle"
          >
            {videoOff ? (
              <VideoOff className="w-5.5 h-5.5" />
            ) : (
              <Camera className="w-5.5 h-5.5" />
            )}
          </button>

          {/* Item 3: Microphone Mute Toggle (Grey circle shape with white crossed mic icon inside) */}
          <button
            onClick={() => {
              setMuted(p => !p);
              triggerHUD(muted ? "MICROPHONE VOICE SIGNAL HOT" : "MIC MUTED SECURE SHIELD ON");
            }}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
              muted 
                ? "bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/40 animate-pulse" 
                : "bg-[#2a2a2c] text-white hover:bg-[#38383a]"
            }`}
            title="Mic toggle"
          >
            {muted ? (
              <MicOff className="w-5.5 h-5.5 text-[#ef4444]" />
            ) : (
              <Mic className="w-5.5 h-5.5" />
            )}
          </button>

          {/* Item 4: Red Decline/Hang Up circular call trigger */}
          <button
            id="decline-call-btn"
            onClick={handleHangupClick}
            className="w-13 h-13 rounded-full bg-[#e61c1c] hover:bg-[#ff3b3b] shadow-[0_0_20px_rgba(230,28,28,0.4)] flex items-center justify-center text-white transition-all duration-150 hover:scale-[1.05] cursor-pointer"
            title="Terminate secure session link"
          >
            <PhoneOff className="w-5.5 h-5.5 stroke-[2.2]" />
          </button>

        </div>
      </div>

      {/* Slide-Up Drawer Dialer Modal for adding contacts to active call */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center animate-fade-in">
          <div className="bg-[#0e1013] border-t-2 border-[#00FF9C]/30 rounded-t-[36px] w-full max-w-sm p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white text-base font-bold font-mono tracking-wider uppercase">Invite To Party</h3>
                <p className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">APPEND UNSECURED AGENTS TO CONFERENCE GRID</p>
              </div>
              <button 
                onClick={() => {
                  setShowAddContactModal(false);
                  setContactSearchQuery("");
                }}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-mono uppercase rounded-lg border border-white/5 transition"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2.5 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-[#00FF9C]" />
              <input 
                type="text"
                placeholder="Search contact matrix..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-white border-none outline-none focus:ring-0 placeholder-gray-500 font-mono"
              />
            </div>

            {/* List scroll panel */}
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
              {dialerContacts
                .filter(u => u.displayName?.toLowerCase().includes(contactSearchQuery.toLowerCase()))
                .map((user) => {
                  const isAlreadyIn = participants.some(p => p.id === user.uid);
                  
                  return (
                    <div 
                      key={user.uid}
                      onClick={() => {
                        if (isAlreadyIn) {
                          setParticipants(p => p.filter(item => item.id !== user.uid));
                          triggerHUD(`${user.displayName.toUpperCase()} REMOVED`);
                        } else {
                          // Assign a dynamic beautiful aesthetic colour border to mock provided image grids
                          const randomColorClasses = [
                            { border: "border-pink-500", text: "text-pink-500", raw: "#ec4899" },
                            { border: "border-purple-500", text: "text-purple-500", raw: "#a855f7" },
                            { border: "border-indigo-500", text: "text-indigo-500", raw: "#6366f1" },
                            { border: "border-amber-500", text: "text-amber-500", raw: "#f59e0b" },
                            { border: "border-emerald-500", text: "text-emerald-500", raw: "#10b981" }
                          ];
                          const selectedColor = randomColorClasses[participants.length % randomColorClasses.length];

                          setParticipants(p => [
                            ...p,
                            {
                              id: user.uid,
                              name: user.displayName || "Unknown node",
                              borderColor: selectedColor.border,
                              textColor: selectedColor.text,
                              colorClass: selectedColor.raw,
                              isSpeaking: true,
                              isYou: false
                            }
                          ]);

                          // Force toggle grid view immediately so they see the multi grids!
                          setIsGridView(true);
                          triggerHUD(`${user.displayName.toUpperCase()} APPENDED TO GRID`);
                        }
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/2 hover:bg-neutral-800/80 transition cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400 font-sans">
                          {user.displayName?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{user.displayName || "N/A"}</p>
                          <p className="text-[9px] font-mono text-gray-500">{user.phoneNumber || "+91 SECRET"}</p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isAlreadyIn
                          ? "bg-[#00FF9C] border-[#00FF9C] text-black"
                          : "border-white/20 bg-transparent"
                      }`}>
                        {isAlreadyIn && <Check className="w-3.5 h-3.5 stroke-[4.5]" />}
                      </div>
                    </div>
                  );
                })}

              {dialerContacts.length === 0 && (
                <p className="text-center py-6 text-xxs font-mono text-gray-500 uppercase">NO CLIENT NODES SYNCED</p>
              )}
            </div>

            <button
              onClick={() => {
                setShowAddContactModal(false);
                setContactSearchQuery("");
                setIsGridView(true); // guarantee Grid activates
              }}
              className="w-full py-3 bg-[#00FF9C] hover:opacity-90 text-black font-mono font-bold text-xxs tracking-widest uppercase rounded-xl transition"
            >
              COMMIT GRID DEPLOYMENT ({participants.length} USERS)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
