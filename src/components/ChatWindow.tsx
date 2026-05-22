import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Phone, Video, Send, Paperclip, ImageIcon, 
  Video as VideoIcon, Camera, Loader2, Check, CheckCheck, 
  MapPin, Sparkles, Shield, AlertCircle
} from "lucide-react";
import { Message, UserProfile } from "../types";
import { sendMessage, updateMessageStatuses } from "../lib/state";
import { useTranslation } from "../lib/i18n";

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
  const { t } = useTranslation();
  const [inputText, setInputText] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  // Camera & Storage integration states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState<"camera" | "gallery" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // Mark all unread messages as read upon entering the room
  useEffect(() => {
    updateMessageStatuses(chatId, senderProfile.uid);
  }, [chatId, messages.length]);

  // Auto-scroll logic inside chats
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping, isUploading]);

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
        
        // Pacing delay
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

  // Launch File Select trigger with Runtime Permissions Consent Check
  const requestPermissionToSelect = (type: "camera" | "gallery") => {
    setShowPermissionModal(type);
  };

  const handlePermissionApproval = () => {
    const activeType = showPermissionModal;
    setShowPermissionModal(null);
    setShowAttachments(false);

    if (activeType === "camera") {
      cameraInputRef.current?.click();
    } else if (activeType === "gallery") {
      fileInputRef.current?.click();
    }
  };

  // Handle selected image or video file
  const handleMediaSelected = async (e: React.ChangeEvent<HTMLInputElement>, defaultType: "image" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detect actual file type
    const isVideo = file.type.startsWith("video/");
    const mediaType = isVideo ? "video" : defaultType;

    setIsUploading(true);
    setUploadProgress(15);

    // progress bar animation for high fidelity user feedback
    const timer = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) {
          clearInterval(timer);
          return 85;
        }
        return prev + 15;
      });
    }, 100);

    try {
      // Convert to Base64 to ensure persistent client-sync matches firebase and offline storage
      const reader = new FileReader();
      const base64String = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      clearInterval(timer);
      setUploadProgress(100);

      setTimeout(async () => {
        setIsUploading(false);
        e.target.value = ""; // clean file pointer
        
        // Push payload to message pool
        await handleSendText(base64String, mediaType);
      }, 400);

    } catch (err) {
      console.error("Media compilation error:", err);
      alert("Failed to encrypt and construct media package.");
      setIsUploading(false);
      clearInterval(timer);
    }
  };

  // Mock location trigger
  const handleAttachLocation = async () => {
    setShowAttachments(false);
    setIsUploading(true);
    setUploadProgress(30);

    setTimeout(async () => {
      setIsUploading(false);
      setInputText(prev => prev + " 📍 [LOCATION: Live Node Location coordinates: Lat 19.07, Lon 72.87]");
    }, 800);
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
    <div id={`chat-window-${chatId}`} className="fixed inset-0 w-full h-full flex flex-col bg-[#050505] text-white overflow-hidden font-sans z-35">
      
      {/* Hidden File Input fields */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={e => handleMediaSelected(e, "image")}
        accept="image/*,video/*"
        className="hidden" 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={e => handleMediaSelected(e, "image")}
        accept="image/*"
        capture="environment"
        className="hidden" 
      />

      {/* Android System Style Permissions Modal */}
      {showPermissionModal && (
        <div id="runtime-permission-alert" className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#0E0E0E] border-2 border-[#00FF9C]/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(0,255,156,0.2)] text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#00FF9C]/10 flex items-center justify-center border border-[#00FF9C]/20">
              <Shield className="w-6 h-6 text-[#00FF9C] animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase font-mono">
                System Runtime Permission
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                {showPermissionModal === "camera" 
                  ? "Allow MAHRAJ Messenger to access your device Camera to capture real-time profile pictures and snaps secure transmission?"
                  : "Allow MAHRAJ Messenger to access your system Gallery photo storage to select images or videos payloads?"
                }
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handlePermissionApproval}
                className="w-full py-2.5 bg-[#00FF9C] text-black hover:bg-[#00FF9C]/80 font-mono text-xs font-bold tracking-widest uppercase rounded-xl transition cursor-pointer"
              >
                GRANT PERMISSION (ALLOW)
              </button>
              <button
                onClick={() => setShowPermissionModal(null)}
                className="w-full py-2 bg-transparent hover:bg-white/5 border border-white/10 text-gray-500 hover:text-white font-mono text-xxs tracking-wider uppercase rounded-xl transition cursor-pointer"
              >
                DENY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="p-3.5 bg-[#0A0A0A] border-b border-[#00FF9C]/20 flex items-center justify-between z-10 shadow-[0_4px_20px_rgba(0,255,156,0.05)]">
        <div className="flex items-center gap-2.5">
          <button id="chat-back-btn" onClick={onBack} className="p-1.5 rounded hover:bg-white/5 transition cursor-pointer">
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
              {isAiTyping ? t("writing_response") : receiverProfile.isOnline ? t("terminal_active") : t("offline_status")}
            </span>
          </div>
        </div>

        {/* Call triggers */}
        <div className="flex items-center gap-3 pr-1">
          <button
            id="voice-call-trigger"
            onClick={() => onInitiateCall("voice")}
            className="p-1.5 border border-[#00FF9C]/10 rounded hover:border-[#00FF9C]/40 hover:bg-white/5 text-gray-400 hover:text-[#00FF9C] transition cursor-pointer"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            id="video-call-trigger"
            onClick={() => onInitiateCall("video")}
            className="p-1.5 border border-[#00FF9C]/10 rounded hover:border-[#00FF9C]/40 hover:bg-white/5 text-gray-400 hover:text-[#00FF9C] transition cursor-pointer"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Zone with authentic modern green wallpaper touch */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col scrollbar-thin bg-[#050505] relative">
        
        {/* Stunning high-definition moon background wallpaper */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black select-none">
          <img 
            src="/src/assets/images/moon_black_4k_1779460318766.png" 
            alt="Celestial Moon Wallpaper" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-20 object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90" />
        </div>

        {messages.length === 0 ? (
          <div className="my-auto py-12 text-center text-gray-500 font-mono text-xs flex flex-col items-center gap-4 relative z-10 select-none">
            <div className="w-40 h-40 rounded-full border border-white/10 bg-black overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.08)] flex items-center justify-center animate-pulse">
              <img 
                src="/src/assets/images/moon_black_4k_1779460318766.png" 
                alt="Moon Element" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[10px] text-gray-400 tracking-widest font-mono uppercase">
              Start Chat Transmission
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === senderProfile.uid;
            const isVideo = m.mediaType === "video";
            
            return (
              <div
                id={`msg-bubble-${m.id}`}
                key={m.id}
                className={`flex flex-col max-w-[85%] sm:max-w-[70%] relative z-10 ${isMe ? "self-end items-end" : "self-start items-start"}`}
              >
                {/* Real-time responsive whatsapp-like speech bubble */}
                <div
                  className={`p-3 rounded-2xl border text-xs shadow-md transition-all relative ${
                    isMe
                      ? "bg-[#0b141a] text-white border-[#00FF9C]/25 rounded-tr-none hover:shadow-[0_0_12px_rgba(0,255,156,0.06)]"
                      : "bg-[#202c33] text-white border-white/5 rounded-tl-none"
                  }`}
                >
                  {/* Media Content - supports both videos and images */}
                  {m.mediaUrl && (
                    <div className="mb-2 max-w-full rounded-xl overflow-hidden border border-white/10 bg-black/30">
                      {isVideo ? (
                        <video 
                          src={m.mediaUrl} 
                          controls 
                          playsInline
                          className="max-h-48 object-cover w-full"
                        />
                      ) : (
                        <img 
                          src={m.mediaUrl} 
                          alt="Attached media file" 
                          referrerPolicy="no-referrer"
                          className="max-h-52 object-cover w-full" 
                        />
                      )}
                    </div>
                  )}

                  <p className="leading-relaxed whitespace-pre-wrap select-text font-sans text-[13px]">
                    {m.text}
                  </p>

                  {/* Stamp & read receipts checks */}
                  <div className="flex justify-end gap-1.5 mt-1.5 text-[9px] font-mono text-gray-400">
                    <span>{formatTime(m.timestamp)}</span>
                    {isMe && (
                      <span>
                        {m.status === "sent" ? (
                          <Check className="w-3.5 h-3.5 text-gray-500" />
                        ) : m.status === "delivered" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-gray-500" />
                        ) : (
                          <CheckCheck className="w-3.5 h-3.5 text-[#00FF9C]" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Dynamic uploading status bar */}
        {isUploading && (
          <div className="self-end flex flex-col items-end max-w-[85%] py-2 relative z-10 font-mono text-[10px] text-[#00FF9C] space-y-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transmitting Secure Media Element ({uploadProgress}%)</span>
            </div>
            <div className="w-24 bg-gray-900 h-1 overflow-hidden rounded">
              <div className="bg-[#00FF9C] h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* AI Typing Loader */}
        {isAiTyping && (
          <div className="self-start flex flex-col items-start max-w-[85%] relative z-10">
            <div className="bg-[#202c33] text-gray-300 text-xs py-2.5 px-4 rounded-2xl rounded-tl-none border border-[#00FF9C]/10 flex items-center gap-2 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00FF9C]" />
              <span>MAHRAJ AI compiling response...</span>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Floating Attachments Drawer */}
      {showAttachments && (
        <div id="attachments-panel" className="absolute bottom-16 left-4 bg-[#0A0A0A] border border-[#00FF9C]/30 rounded-2xl p-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.9)] flex gap-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            onClick={() => requestPermissionToSelect("camera")}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[9px] text-gray-400 hover:text-[#00FF9C] transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-950/40 flex items-center justify-center border border-orange-500/50">
              <Camera className="w-4.5 h-4.5 text-orange-400" />
            </div>
            <span>CAMERA</span>
          </button>

          <button
            onClick={() => requestPermissionToSelect("gallery")}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[9px] text-gray-400 hover:text-[#00FF9C] transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-950/40 flex items-center justify-center border border-cyan-500/50">
              <ImageIcon className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <span>GALLERY</span>
          </button>

          <button
            onClick={handleAttachLocation}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[9px] text-gray-400 hover:text-[#00FF9C] transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-950/40 flex items-center justify-center border border-emerald-500/50">
              <MapPin className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <span>LOCATION</span>
          </button>
        </div>
      )}

      {/* custom neon input bar at bottom */}
      <div className="p-3 bg-[#0A0A0A] border-t border-white/5 flex items-center gap-2 z-10">
        <button
          onClick={() => setShowAttachments(!showAttachments)}
          className="p-2 border border-white/5 rounded-full bg-[#121212] text-[#00FF9C] hover:bg-white/5 transition cursor-pointer"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          id="chat-message-input"
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("type_message_placeholder")}
          className="flex-1 bg-[#121212] border border-[#00FF9C]/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] font-sans"
        />

        <button
          id="chat-send-btn"
          onClick={() => handleSendText()}
          className="h-10 w-10 bg-[#00FF9C] rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,255,156,0.25)] hover:bg-[#00FF9C]/80 transition cursor-pointer"
        >
          <Send className="w-4 h-4 text-[#050505]" />
        </button>
      </div>
    </div>
  );
}
