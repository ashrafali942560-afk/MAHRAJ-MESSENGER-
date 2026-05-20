import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Phone, Video, Send, Paperclip, ImageIcon, 
  Video as VideoIcon, Camera, Loader2, Check, CheckCheck, 
  MapPin, Sparkles, Smile 
} from "lucide-react";
import { Message, UserProfile } from "../types";
import { sendMessage, updateMessageStatuses } from "../lib/state";

interface ChatWindowProps {
  chatId: string;
  senderProfile: UserProfile;
  receiverProfile: UserProfile;
  messages: Message[];
  onBack: () => void;
  onInitiateCall: (type: "voice" | "video") => void;
}

export function ChatWindow({
  chatId,
  senderProfile,
  receiverProfile,
  messages,
  onBack,
  onInitiateCall
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // Mark all unread messages as read upon entering the room
  useEffect(() => {
    updateMessageStatuses(chatId, senderProfile.uid);
  }, [chatId, messages.length]);

  // Auto-scroll logic inside chats
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const handleSendText = async (mediaUrl?: string, mediaType?: "image" | "video") => {
    if (!inputText.trim() && !mediaUrl) return;

    const messageText = inputText;
    setInputText("");
    setShowAttachments(false);

    // Write real message to local database (firestore fallback)
    await sendMessage(chatId, senderProfile.uid, messageText, mediaUrl, mediaType);

    // If talking to MAHRAJ AI Bot, trigger the server-side Gemini API proxy!
    if (receiverProfile.uid === "ai-bot") {
      setIsAiTyping(true);
      
      try {
        // Construct basic history chain for context
        const localHistory = [
          ...messages,
          { id: "temp", senderId: senderProfile.uid, text: messageText, timestamp: new Date().toISOString(), status: "read" as const }
        ].map(m => ({
          senderId: m.senderId === senderProfile.uid ? "user" : "ai-bot",
          text: m.text
        }));

        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: localHistory })
        });

        const data = await response.json();
        
        // Dynamic reading pacing delay
        setTimeout(async () => {
          setIsAiTyping(false);
          await sendMessage(
            chatId, 
            "ai-bot", 
            data.text || "I am currently adjusting my high-frequency neural loops. Please try again, Syed Sahab!"
          );
        }, 1200 + Math.random() * 800);

      } catch (err) {
        console.error("Gemini chatbot transmission crash: ", err);
        setIsAiTyping(false);
        await sendMessage(
          chatId, 
          "ai-bot", 
          "System offline. Standard AI loop check failed. Please verify process.env.GEMINI_API_KEY in settings."
        );
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendText();
    }
  };

  // Mock Asset Attachment Engine
  const attachMockMedia = async (type: "image" | "video") => {
    const images = [
      "https://images.unsplash.com/photo-1515260268569-9271009adfdb?auto=format&fit=crop&q=80&w=500",
      "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=500",
      "https://images.unsplash.com/photo-1562813733-b31f71025d54?auto=format&fit=crop&q=80&w=500",
      "https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&q=80&w=500"
    ];

    const randomImage = images[Math.floor(Math.random() * images.length)];
    await handleSendText(randomImage, type);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "00:00";
    }
  };

  return (
    <div id={`chat-window-${chatId}`} className="flex flex-col h-full bg-[#050505] text-white overflow-hidden relative font-sans">
      
      {/* Top Navigation Bar */}
      <div className="p-3.5 bg-[#0A0A0A] border-b border-[#00FF9C]/20 flex items-center justify-between z-10 shadow-[0_4px_20px_rgba(0,255,156,0.05)]">
        <div className="flex items-center gap-2.5">
          <button id="chat-back-btn" onClick={onBack} className="p-1 rounded hover:bg-white/5 transition">
            <ArrowLeft className="w-5 h-5 text-[#00FF9C]" />
          </button>
          
          <div className="relative">
            <img
              src={receiverProfile.photoURL}
              alt={receiverProfile.displayName}
              className="w-10 h-10 rounded-full object-cover border border-[#00FF9C]/40"
            />
            {receiverProfile.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A]" />
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold tracking-wide text-white font-sans flex items-center gap-1.5">
              {receiverProfile.displayName}
              {receiverProfile.uid === "ai-bot" && (
                <Sparkles className="w-3.5 h-3.5 text-[#00FF9C] animate-pulse" />
              )}
            </h3>
            <span className="text-[10px] text-[#00FF9C] font-mono tracking-widest font-semibold uppercase">
              {isAiTyping ? "Writing response..." : receiverProfile.isOnline ? "TERMINAL ACTIVE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Call triggers */}
        <div className="flex items-center gap-4 pr-1">
          <button
            id="voice-call-trigger"
            onClick={() => onInitiateCall("voice")}
            className="p-1.5 border border-[#00FF9C]/10 rounded hover:border-[#00FF9C]/40 hover:bg-white/5 text-gray-400 hover:text-[#00FF9C] transition"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            id="video-call-trigger"
            onClick={() => onInitiateCall("video")}
            className="p-1.5 border border-[#00FF9C]/10 rounded hover:border-[#00FF9C]/40 hover:bg-white/5 text-gray-400 hover:text-[#00FF9C] transition"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Zone */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col scrollbar-thin bg-[radial-gradient(circle_at_center,_#111111_0%,_#050505_100%)]">
        {messages.length === 0 ? (
          <div className="my-auto py-12 text-center text-gray-650 font-mono text-xs flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full border border-white/5 bg-[#0A0A0A] flex items-center justify-center">
              🔐
            </div>
            <span>Transmission channel secured. End-to-end local encryption configured.</span>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === senderProfile.uid;
            return (
              <div
                id={`msg-bubble-${m.id}`}
                key={m.id}
                className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
              >
                {/* Neon Bubbles */}
                <div
                  className={`p-3 rounded-2xl border text-xs shadow-md transition-all ${
                    isMe
                      ? "bg-[#080808] text-[#00FF9C] border-[#00FF9C]/30 rounded-tr-none hover:shadow-[0_0_12px_rgba(0,255,156,0.08)]"
                      : "bg-[#1A1A1A] text-white border-white/5 rounded-tl-none"
                  }`}
                >
                  {/* Media Content */}
                  {m.mediaUrl && (
                    <div className="mb-2 max-w-full rounded-lg overflow-hidden border border-white/5">
                      <img src={m.mediaUrl} alt="Attached Media" className="max-h-48 object-cover w-full" />
                    </div>
                  )}

                  <p className="leading-relaxed whitespace-pre-wrap select-text font-sans text-[13px]">
                    {m.text}
                  </p>

                  {/* Stamp & receipt checkmarks */}
                  <div className="flex justify-end gap-1.5 mt-1.5 text-[9px] font-mono text-gray-500">
                    <span>{formatTime(m.timestamp)}</span>
                    {isMe && (
                      <span>
                        {m.status === "sent" ? (
                          <Check className="w-3 h-3 text-gray-650" />
                        ) : m.status === "delivered" ? (
                          <CheckCheck className="w-3 h-3 text-gray-500" />
                        ) : (
                          <CheckCheck className="w-3 h-3 text-[#00FF9C]" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* AI Typing Loader */}
        {isAiTyping && (
          <div className="self-start flex flex-col items-start max-w-[75%]">
            <div className="bg-[#1A1A1A] text-gray-450 text-xs py-2.5 px-4 rounded-2xl rounded-tl-none border border-[#00FF9C]/10 flex items-center gap-2 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00FF9C]" />
              <span>MAHRAJ AI compiling response...</span>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Floating Attachments Drawer */}
      {showAttachments && (
        <div id="attachments-panel" className="absolute bottom-16 left-4 bg-[#080808] border-2 border-[#00FF9C]/40 rounded-xl p-3 shadow-[0_0_20px_rgba(0,255,156,0.25)] flex gap-4 z-20">
          <button
            onClick={() => attachMockMedia("image")}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[10px] text-gray-300"
          >
            <div className="w-9 h-9 rounded-full bg-cyan-900/50 flex items-center justify-center border border-cyan-400">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
            </div>
            <span>Image</span>
          </button>

          <button
            onClick={() => attachMockMedia("video")}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[10px] text-gray-300"
          >
            <div className="w-9 h-9 rounded-full bg-purple-900/50 flex items-center justify-center border border-purple-400">
              <VideoIcon className="w-4 h-4 text-purple-400" />
            </div>
            <span>Video</span>
          </button>

          <button
            onClick={async () => {
              setInputText(prev => prev + " • [LIVE_NEON_SYS_COORDS: Lat 19.07, Lon 72.87]");
              setShowAttachments(false);
            }}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[10px] text-gray-300"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-900/50 flex items-center justify-center border border-emerald-400">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <span>Location</span>
          </button>
        </div>
      )}

      {/* custom neon input bar at bottom */}
      <div className="p-3 bg-[#080808]/90 border-t border-white/5 flex items-center gap-2.5 z-10">
        <button
          onClick={() => setShowAttachments(!showAttachments)}
          className="p-2 border border-white/5 rounded-full bg-gray-950/50 text-[#00FF9C] hover:bg-white/5 transition"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          id="chat-message-input"
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a neon message..."
          className="flex-1 bg-[#121212] border border-[#00FF9C]/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-650 focus:outline-none focus:border-[#00FF9C] font-sans"
        />

        <button
          id="chat-send-btn"
          onClick={() => handleSendText()}
          className="h-10 w-10 bg-[#00FF9C] rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,255,156,0.25)] hover:bg-[#00FF9C]/80 transition"
        >
          <Send className="w-4 h-4 text-[#050505]" />
        </button>
      </div>
    </div>
  );
}
