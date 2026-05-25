import React, { useState, useRef, useEffect } from "react";
import { 
  X, Check, Globe, RefreshCw, 
  ShieldCheck, ArrowRight, User, Key, LogOut, Bell, Upload, Image, Mail,
  Sun, Moon, Lock, MessageSquare, Keyboard, HelpCircle, ChevronLeft, Volume2, ShieldAlert,
  ChevronRight, Laptop, Sparkles, MessageSquareCode
} from "lucide-react";
import { UserProfile } from "../types";
import { LANGUAGES, useTranslation } from "../lib/i18n";
import { saveUserProfile } from "../lib/state";
import { compressImageBase64 } from "../lib/imageCompressor";
import { getWebPushToken } from "../firebase";

interface SettingsPanelProps {
  userProfile: UserProfile | null;
  onClose: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  onLogout: () => void;
  forceMockMode: boolean;
  onSetForceMockMode: (force: boolean) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function SettingsPanel({
  userProfile,
  onClose,
  onUpdateProfile,
  onLogout,
  forceMockMode,
  onSetForceMockMode,
  theme,
  onToggleTheme
}: SettingsPanelProps) {
  const { t, currentLanguage, setLanguage } = useTranslation();
  
  // Navigation active tab category
  const [activeCategory, setActiveCategory] = useState<"menu" | "profile" | "account" | "privacy" | "chats" | "notifications" | "shortcuts" | "help">("menu");

  // Profile fields state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [username, setUsername] = useState(userProfile?.username || "");
  const [bio, setBio] = useState(userProfile?.bio || "");
  const [avatar, setAvatar] = useState(userProfile?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Privacy custom states (persisted to localStorage)
  const [disappearingMessages, setDisappearingMessages] = useState<string>(() => {
    return localStorage.getItem("settings_disappearing_messages") || "Off";
  });
  const [blockedUsers, setBlockedUsers] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem("settings_blocked_users") || "[]");
  });
  const [showAddBlockUser, setShowAddBlockUser] = useState(false);
  const [newBlockInput, setNewBlockInput] = useState("");

  // Chats states
  const [globalWallpaper, setGlobalWallpaper] = useState<string>(() => {
    return localStorage.getItem("settings_global_wallpaper") || "celestial_moon";
  });
  const [chatSettingsSync, setChatSettingsSync] = useState<boolean>(() => {
    return localStorage.getItem("settings_chat_sync") !== "false";
  });

  // Notifications states
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("settings_sound_enabled") !== "false";
  });
  const [notificationPreview, setNotificationPreview] = useState<boolean>(() => {
    return localStorage.getItem("settings_notification_preview") !== "false";
  });
  const [fcmTokenState, setFcmTokenState] = useState(userProfile?.fcmToken || "");
  const [isConfiguringFcm, setIsConfiguringFcm] = useState(false);
  const [fcmCopied, setFcmCopied] = useState(false);

  // Help & feedback simulated contact box
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Logout confirm modal state
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);

  // Auto-sync profile values when userProfile resolves
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setUsername(userProfile.username || "");
      setBio(userProfile.bio || "");
      setAvatar(userProfile.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200");
      setFcmTokenState(userProfile.fcmToken || "");
    }
  }, [userProfile]);

  // Image Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawBase64 = reader.result as string;
        // Compress photo to JPEG for maximum database efficiency
        const compressedBase64 = await compressImageBase64(rawBase64, 150, 150, 0.7);
        setAvatar(compressedBase64);
        await handleSaveBasicInfo("photoURL", compressedBase64);
      } catch (err) {
        console.error("Compression warning:", err);
      } finally {
        setUploadingImage(false);
      }
    };
    reader.onerror = () => {
      setUploadingImage(false);
      alert("Error reading chosen image file from your device.");
    };
    reader.readAsDataURL(file);
  };

  // Profile basic info save proxy
  const handleSaveBasicInfo = async (field: "displayName" | "username" | "bio" | "photoURL", val: string) => {
    if (!userProfile) return;
    const updated = {
      ...userProfile,
      [field]: val
    };
    onUpdateProfile(updated);
    await saveUserProfile(updated);
  };

  // Save disappearing messages settings
  const handleSaveDisappearingMessages = (val: string) => {
    setDisappearingMessages(val);
    localStorage.setItem("settings_disappearing_messages", val);
  };

  // Block a user manually
  const handleBlockUser = () => {
    if (!newBlockInput.trim()) return;
    const updated = [...blockedUsers, newBlockInput.trim()];
    setBlockedUsers(updated);
    localStorage.setItem("settings_blocked_users", JSON.stringify(updated));
    setNewBlockInput("");
    setShowAddBlockUser(false);
  };

  // Unblock a user
  const handleUnblockUser = (u: string) => {
    const updated = blockedUsers.filter(item => item !== u);
    setBlockedUsers(updated);
    localStorage.setItem("settings_blocked_users", JSON.stringify(updated));
  };

  // Toggle global default wallpaper and dispatch settings update
  const handleSaveGlobalWallpaper = (val: string) => {
    setGlobalWallpaper(val);
    localStorage.setItem("settings_global_wallpaper", val);
    // Let any listening ChatWindow updates know of changes
    window.dispatchEvent(new Event("mahraj_global_wallpaper_changed"));
  };

  // FCM Device Activator Gateway
  const handleActivatePush = async () => {
    setIsConfiguringFcm(true);
    try {
      const token = await getWebPushToken();
      if (token) {
        setFcmTokenState(token);
        if (userProfile) {
          const updated = {
            ...userProfile,
            fcmToken: token
          };
          onUpdateProfile(updated);
          await saveUserProfile(updated);
        }
      }
    } catch (e) {
      console.error("Error setting up active FCM session", e);
    } finally {
      setIsConfiguringFcm(false);
    }
  };

  const copyFcmTokenToClipboard = () => {
    if (!fcmTokenState) return;
    navigator.clipboard.writeText(fcmTokenState);
    setFcmCopied(true);
    setTimeout(() => setFcmCopied(false), 2000);
  };

  // Submit Simulated Feedback
  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSubject.trim() || !feedbackBody.trim()) return;
    setFeedbackSuccess(true);
    setFeedbackSubject("");
    setFeedbackBody("");
    setTimeout(() => setFeedbackSuccess(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#050505]/95 flex items-center justify-center p-4 overflow-y-auto">
      {/* Container Card in deep slate-charcoal black */}
      <div className="w-full max-w-md bg-[#0F0F0F] border border-white/5 rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">
        
        {/* Header Ribbon bar */}
        <div className="px-5 py-4 bg-[#0A0A0A] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeCategory !== "menu" && (
              <button 
                onClick={() => setActiveCategory("menu")}
                className="p-1 mr-1 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition flex items-center"
              >
                <ChevronLeft className="w-5 h-5 text-[#00FF9C]" />
              </button>
            )}
            <span className="text-white text-xs font-mono font-bold tracking-widest uppercase text-[#00FF9C]">
              {activeCategory === "menu" ? "Settings" : `${activeCategory} options`}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Nested Screen Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          
          {/* CATEGORY 1: Core Menu Hub Options list exactly like user's styled image */}
          {activeCategory === "menu" && (
            <div className="space-y-6">
              {/* Circular Avatar overlap region at the top */}
              <div className="flex flex-col items-center py-4 relative">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#00FF9C] to-cyan-500 shadow-[0_0_20px_rgba(0,255,156,0.15)]">
                  <img 
                    src={avatar} 
                    alt={displayName || "User"} 
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#0F0F0F]"
                  />
                  <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#00FF9C] border-2 border-[#0F0F0F]" />
                </div>
                <h3 className="text-white font-semibold text-lg mt-3 tracking-wide">{displayName || "Anonymous Node"}</h3>
                <p className="text-gray-500 font-mono text-xs mt-0.5">@{username || "unset_node"}</p>
                {bio && <p className="text-gray-400 text-xxs italic text-center max-w-xs mt-1 px-4">"{bio}"</p>}
              </div>

              {/* Main settings options tree, exactly aligned to screenshot layout and icons */}
              <div className="space-y-1 divide-y divide-white/5">
                
                {/* PROFILE */}
                <button
                  onClick={() => setActiveCategory("profile")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <User className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Profile</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Name, profile photo</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* ACCOUNT */}
                <button
                  onClick={() => setActiveCategory("account")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <Key className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Account</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Security notifications, account info</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* PRIVACY */}
                <button
                  onClick={() => setActiveCategory("privacy")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <Lock className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Privacy</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Blocked contacts, disappearing messages</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* CHATS */}
                <button
                  onClick={() => setActiveCategory("chats")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <MessageSquare className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Chats</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Theme, wallpaper, chat settings</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* NOTIFICATIONS */}
                <button
                  onClick={() => setActiveCategory("notifications")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <Bell className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Notifications</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Messages, groups, sounds</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* KEYBOARD SHORTCUTS */}
                <button
                  onClick={() => setActiveCategory("shortcuts")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <Keyboard className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Keyboard shortcuts</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Quick actions</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* HELP AND FEEDBACK */}
                <button
                  onClick={() => setActiveCategory("help")}
                  className="w-full py-4 text-left flex items-start gap-4 hover:bg-white/5 rounded-xl px-2.5 transition active:scale-99"
                >
                  <div className="p-2.5 bg-neutral-900 border border-white/5 text-gray-400 rounded-lg mt-0.5">
                    <HelpCircle className="w-5 h-5 text-neutral-350" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white/95 text-sm font-semibold tracking-wide">Help and feedback</h4>
                    <p className="text-gray-400 text-xs mt-0.5">Help center, contact us, privacy policy</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 mt-4" />
                </button>

                {/* LOG OUT with absolute confirmation toggles */}
                <div className="pt-3">
                  {!showConfirmLogout ? (
                    <button
                      onClick={() => setShowConfirmLogout(true)}
                      className="w-full py-3.5 hover:bg-red-500/5 text-red-500 rounded-xl px-2.5 transition flex items-center gap-4 text-left font-semibold active:scale-99"
                    >
                      <div className="p-2.5 bg-red-950/10 border border-red-500/10 text-red-500 rounded-lg">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold tracking-wide">Log out</h4>
                      </div>
                    </button>
                  ) : (
                    <div className="bg-[#120505] border border-red-500/20 p-4 rounded-2xl space-y-3.5 mt-2 animate-in fade-in zoom-in-95 duration-150">
                      <p className="text-red-400 text-xs font-mono font-bold tracking-wider uppercase text-center animate-pulse">
                        ⚠️ CONFIRM LOGOUT ⚠️
                      </p>
                      <p className="text-gray-400 text-xxs leading-relaxed text-center">
                        Are you sure you want to end your current session and disconnect from the Firestore server? Unsaved local logs will stay local.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowConfirmLogout(false)}
                          className="flex-1 py-2 border border-white/5 hover:border-white/10 text-gray-300 text-xxs font-mono rounded active:scale-95 transition"
                        >
                          CANCEL //
                        </button>
                        <button
                          onClick={onLogout}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-mono text-xxs font-bold rounded active:scale-95 transition"
                        >
                          LOGOUT //
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: PROFILE */}
          {activeCategory === "profile" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col items-center gap-3 bg-black/30 p-4 rounded-2xl border border-white/5">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#00FF9C] flex items-center justify-center bg-black">
                    {uploadingImage ? (
                      <RefreshCw className="w-5 h-5 text-[#00FF9C] animate-spin" />
                    ) : (
                      <img src={avatar} alt="Avatar edit" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150">
                    <Upload className="w-4 h-4 text-[#00FF9C] animate-bounce" />
                    <span className="text-[7px] font-mono text-[#00FF9C] uppercase font-bold mt-0.5">Browse</span>
                  </div>
                </div>
                
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 bg-neutral-900 hover:bg-neutral-850 text-[#00FF9C] border border-[#00FF9C]/20 rounded-lg text-[10px] font-mono uppercase tracking-wider transition"
                >
                  {uploadingImage ? "Uploading..." : "Upload New Photo //"}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    onBlur={e => handleSaveBasicInfo("displayName", e.target.value)}
                    className="w-full bg-[#121212] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00FF9C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-550 font-mono text-xs">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                      onBlur={e => handleSaveBasicInfo("username", e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                      className="w-full bg-[#121212] border border-white/5 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00FF9C] font-mono"
                      placeholder="e.g. syed_sahab"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Bio</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    onBlur={e => handleSaveBasicInfo("bio", e.target.value)}
                    className="w-full bg-[#121212] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FF9C] resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 bg-[#00FF9C] text-black font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase hover:bg-[#00FF9C]/80"
              >
                SAVE & RETURN //
              </button>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: ACCOUNT */}
          {activeCategory === "account" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3.5">
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider">Account Credentials</span>
                
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-mono block uppercase">Authenticated ID Platform</span>
                  <p className="text-white text-xs font-mono bg-[#121212] p-2 rounded border border-white/5 select-all overflow-x-auto whitespace-nowrap scrollbar-none">
                    {userProfile?.email || "Local Anonymous Client"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-mono block uppercase">Database Node Identifier</span>
                  <p className="text-gray-400 text-xxs font-mono bg-[#121212] p-2 rounded border border-white/5 select-all overflow-x-auto whitespace-nowrap scrollbar-none">
                    {userProfile?.uid || "mock-database-uid"}
                  </p>
                </div>
              </div>

              <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 space-y-3">
                <span className="text-[10px] font-mono text-[#00D1FF] uppercase font-bold tracking-wider block">Security Notifications</span>
                <p className="text-gray-400 text-xxs leading-relaxed">
                  Turn on login email alerts. Receive end-to-end device confirmation tokens whenever a temporary browser context accesses your secret inbox.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-white font-medium">Auto zero-trust security flags</span>
                  <div className="w-9 h-5 rounded-full bg-[#00FF9C]/20 border border-[#00FF9C] p-0.5 relative cursor-pointer">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#00FF9C] absolute right-0.5 top-0.5" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase"
              >
                ← BACK TO MENU
              </button>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: PRIVACY */}
          {activeCategory === "privacy" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Disappearing Messages Duration toggler */}
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider block">Disappearing Messages</span>
                <p className="text-gray-400 text-xxs leading-relaxed">
                  When enabled, newly sent messages will automatically delete from Firestore both locally and in the target cloud terminal.
                </p>

                <div className="grid grid-cols-4 gap-1.5 pt-1 bg-black/50 p-1.5 rounded-xl border border-white/5">
                  {["Off", "24h", "7d", "90d"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleSaveDisappearingMessages(opt)}
                      className={`py-1 text-[10px] font-mono font-bold rounded uppercase transition ${
                        disappearingMessages === opt 
                          ? "bg-[#00FF9C] text-black" 
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blocked contacts list manager */}
              <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-red-400 uppercase font-bold tracking-wider">Blocked Contacts ({blockedUsers.length})</span>
                  <button
                    onClick={() => setShowAddBlockUser(prev => !prev)}
                    className="text-[9px] font-mono text-red-400 border border-red-500/20 px-2 py-0.5 rounded hover:bg-red-500/10 transition uppercase"
                  >
                    {showAddBlockUser ? "CLOSE" : "BLOCK +"}
                  </button>
                </div>

                {showAddBlockUser && (
                  <div className="flex gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                    <input
                      type="text"
                      value={newBlockInput}
                      onChange={e => setNewBlockInput(e.target.value)}
                      placeholder="Username or ID to block"
                      className="flex-1 bg-black text-xxs px-2.5 py-1.5 rounded border border-white/5 focus:outline-none focus:border-red-500 text-white font-mono"
                    />
                    <button
                      onClick={handleBlockUser}
                      className="px-3 bg-red-600 hover:bg-red-700 text-white font-mono text-[9px] font-bold rounded transition"
                    >
                      SAVE
                    </button>
                  </div>
                )}

                {blockedUsers.length === 0 ? (
                  <p className="text-gray-500 text-xxs font-mono italic">No users currently blocked.</p>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(u => (
                      <div key={u} className="flex items-center justify-between p-2 bg-[#0A0A0A] rounded-lg border border-white/5">
                        <span className="text-xs font-mono text-gray-300">@{u}</span>
                        <button
                          onClick={() => handleUnblockUser(u)}
                          className="text-[9px] font-mono text-gray-500 hover:text-[#00FF9C] transition uppercase"
                        >
                          UNBLOCK //
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase"
              >
                ← BACK TO MENU
              </button>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: CHATS */}
          {activeCategory === "chats" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Display Mode Theme selector */}
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3.5">
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider">Theme Profile Mode</span>
                
                <div className="grid grid-cols-2 gap-2 bg-[#121212] p-1.5 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => theme !== "light" && onToggleTheme()}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      theme === "light"
                        ? "bg-[#00FF9C]/15 text-[#00FF9C] border border-[#00FF9C]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>LIGHT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => theme !== "dark" && onToggleTheme()}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      theme === "dark"
                        ? "bg-[#00FF9C]/15 text-[#00FF9C] border border-[#00FF9C]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Moon className="w-4 h-4 text-cyan-400" />
                    <span>DARK MODE</span>
                  </button>
                </div>
              </div>

              {/* Chat Wallpaper Background selection */}
              <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 space-y-3">
                <span className="text-[10px] font-mono text-[#00D1FF] uppercase font-bold tracking-wider">Default Chat Wallpaper</span>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "celestial_moon", name: "Celestial Moon" },
                    { key: "solid_charcoal", name: "Solid Charcoal" },
                    { key: "solid_teal", name: "Midnight Teal" },
                    { key: "emerald_whatsapp", name: "WhatsApp Green" },
                    { key: "solid_indigo", name: "Neon Indigo" },
                    { key: "neon_grid", name: "Cyberpunk Grid" }
                  ].map(w => (
                    <button
                      key={w.key}
                      onClick={() => handleSaveGlobalWallpaper(w.key)}
                      className={`p-2.5 rounded-xl border text-[10px] font-mono transition text-left flex flex-col justify-between ${
                        globalWallpaper === w.key 
                          ? "bg-[#00FF9C]/5 border-[#00FF9C] text-[#00FF9C]" 
                          : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/15"
                      }`}
                    >
                      <span className="font-bold">{w.name}</span>
                      <span className="text-[7.5px] uppercase font-mono tracking-widest text-gray-500 mt-1">Preset</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider">Offline Message Sync</span>
                  <p className="text-gray-500 text-[10px]">Auto-download missing database backlogs</p>
                </div>
                <button
                  onClick={() => {
                    const next = !chatSettingsSync;
                    setChatSettingsSync(next);
                    localStorage.setItem("settings_chat_sync", String(next));
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition cursor-pointer border ${
                    chatSettingsSync ? "bg-[#00FF9C]/20 border-[#00FF9C] flex justify-end" : "bg-neutral-850 border-neutral-700 flex justify-start"
                  }`}
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-slate-300" />
                </button>
              </div>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase"
              >
                ← BACK TO MENU
              </button>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: NOTIFICATIONS */}
          {activeCategory === "notifications" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Notification Sounds selector toggle */}
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> Message sound alerts
                  </span>
                  <p className="text-gray-400 text-xxs">Play audio feedback upon incoming syncs</p>
                </div>
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    localStorage.setItem("settings_sound_enabled", String(next));
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition cursor-pointer border ${
                    soundEnabled ? "bg-[#00FF9C]/20 border-[#00FF9C] flex justify-end" : "bg-neutral-850 border-neutral-700 flex justify-start"
                  }`}
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-slate-200" />
                </button>
              </div>

              {/* Message Toast Preview selection */}
              <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-[#00D1FF] uppercase font-bold tracking-wider">Interactive Previews</span>
                  <p className="text-gray-400 text-xxs">Show content summaries on top toast banner</p>
                </div>
                <button
                  onClick={() => {
                    const next = !notificationPreview;
                    setNotificationPreview(next);
                    localStorage.setItem("settings_notification_preview", String(next));
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition cursor-pointer border ${
                    notificationPreview ? "bg-[#00FF9C]/20 border-[#00FF9C] flex justify-end" : "bg-neutral-850 border-neutral-700 flex justify-start"
                  }`}
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-slate-200" />
                </button>
              </div>

              {/* FCM Cloud Push Gateway settings */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider">Web Push Cloud Gateway</span>
                  {!fcmTokenState && (
                    <button
                      onClick={handleActivatePush}
                      className="text-[9px] font-mono text-[#00FF9C] border border-[#00FF9C]/20 px-2.5 py-1 rounded hover:bg-emerald-950/20 transition cursor-pointer"
                    >
                      {isConfiguringFcm ? "LOADING..." : "ACTIVATE"}
                    </button>
                  )}
                </div>

                <div className="bg-[#121212] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-mono text-gray-500 uppercase block">NOTIFICATION ENGINE CONFIG</span>
                      <p className={`font-mono text-xs font-bold tracking-widest ${fcmTokenState ? 'text-[#00FF9C]' : 'text-[#00D1FF]'}`}>
                        {fcmTokenState ? "CONNECTED (VAPID)" : "INACTIVE PROTOCOL"}
                      </p>
                    </div>
                    {fcmTokenState && (
                      <span className="bg-[#00FF9C]/10 border border-[#00FF9C]/30 text-[#00FF9C] px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest animate-pulse">
                        ONLINE
                      </span>
                    )}
                  </div>

                  {fcmTokenState && (
                    <div className="space-y-1 pt-1 border-t border-white/5">
                      <span className="text-[8px] font-mono text-gray-650 uppercase block">REGISTRATION TOKEN OUTPORT</span>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-black px-2 py-1.5 rounded border border-[#00D1FF]/20 overflow-x-auto max-h-[50px] scrollbar-thin">
                          <p className="text-[#00D1FF] font-mono text-[9px] whitespace-normal break-all select-all">
                            {fcmTokenState}
                          </p>
                        </div>
                        <button
                          onClick={copyFcmTokenToClipboard}
                          className="bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/30 px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase shrink-0 transition"
                        >
                          {fcmCopied ? "COPIED" : "COPY KEY"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase"
              >
                ← BACK TO MENU
              </button>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: KEYBOARD SHORTCUTS */}
          {activeCategory === "shortcuts" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3.5">
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider">Workspace Shortcut binds</span>
                
                <div className="space-y-2">
                  {[
                    { keys: ["ESC"], action: "Close active Chat Panel" },
                    { keys: ["Ctrl", "Alt", "N"], action: "Trigger New Group Chat creation panel" },
                    { keys: ["Ctrl", "Alt", "S"], action: "Access general Profile & System Settings" },
                    { keys: ["Enter"], action: "Simulate zero-lag instant send of typing buffer" },
                    { keys: ["Shift", "Enter"], action: "Insert responsive line break into text-area" }
                  ].map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-[#121212] border border-white/5">
                      <span className="text-gray-300 text-xxs font-sans">{s.action}</span>
                      <div className="flex gap-1">
                        {s.keys.map(k => (
                          <kbd key={k} className="px-1.5 py-0.5 bg-black text-[#00FF9C] border border-white/10 rounded font-mono text-[8px] uppercase tracking-wider">
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1.5 text-center">
                <Laptop className="w-6 h-6 text-[#00FF9C] mx-auto opacity-70" />
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider block">PRO KEYBOARD NAVIGATION</span>
                <p className="text-gray-400 text-xxs leading-relaxed">
                  These system accelerators operate inside both mobile simulators and developer consoles for lightning productivity.
                </p>
              </div>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase"
              >
                ← BACK TO MENU
              </button>
            </div>
          )}

          {/* ACTIVE CATEGORY VIEW: HELP AND FEEDBACK */}
          {activeCategory === "help" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Help articles layout links */}
              <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 space-y-3">
                <span className="text-[10px] font-mono text-[#00FF9C] uppercase font-bold tracking-wider block">Frequently Asked Questions</span>
                
                <div className="space-y-2 text-left">
                  {[
                    "How do disappearing status logs work?",
                    "Are local sqlite mock instances securely encrypted?",
                    "Can I pair multiple custom VAPID cloud keys?"
                  ].map((q, idx) => (
                    <details 
                      key={idx} 
                      className="group p-2.5 bg-black/40 rounded-xl border border-white/5 cursor-pointer outline-none"
                    >
                      <summary className="text-[10px] font-semibold text-gray-300 hover:text-white flex justify-between items-center list-none uppercase font-mono tracking-wide">
                        <span>{q}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-open:rotate-90 transition transform" />
                      </summary>
                      <p className="text-gray-400 text-xxs mt-2 leading-relaxed">
                        MAHRAJ secure protocols handle all background state compression and sync transparently across standard browser clients. Yes, zero logs leak on disk.
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Feed contact simulated box */}
              <form onSubmit={handleSendFeedback} className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
                <span className="text-[10px] font-mono text-[#00D1FF] uppercase font-bold tracking-wider block">Contact us // Feedback tickets</span>
                
                {feedbackSuccess && (
                  <div className="p-3 bg-emerald-950/20 border border-[#00FF9C]/30 text-[#00FF9C] rounded-xl text-center text-xxs font-mono uppercase tracking-wider animate-pulse">
                    <Sparkles className="w-4 h-4 mx-auto mb-1 animate-spin" />
                    Feedback Ticket posted successfully!
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={feedbackSubject}
                    onChange={e => setFeedbackSubject(e.target.value)}
                    placeholder="Ticket Category / Subject"
                    className="w-full bg-[#121212] text-xs px-2.5 py-2 rounded-xl border border-white/5 focus:outline-none focus:border-[#00D1FF] text-white font-mono"
                  />
                  <textarea
                    rows={3}
                    required
                    value={feedbackBody}
                    onChange={e => setFeedbackBody(e.target.value)}
                    placeholder="Describe query, report anomaly, or supply suggestion details..."
                    className="w-full bg-[#121212] text-xs px-2.5 py-2 rounded-xl border border-white/5 focus:outline-none focus:border-[#00D1FF] text-white resize-none"
                  />
                  
                  <button
                    type="submit"
                    className="w-full py-2 bg-neutral-900 border border-[#00D1FF]/40 text-[#00D1FF] hover:bg-neutral-850 font-mono text-[10px] font-bold tracking-widest uppercase rounded-lg transition"
                  >
                    POST SECURE TICKET
                  </button>
                </div>
              </form>

              <button
                onClick={() => setActiveCategory("menu")}
                className="w-full py-2.5 border border-[#00FF9C]/30 hover:border-[#00FF9C] text-[#00FF9C] font-mono text-xs font-bold tracking-widest rounded-xl transition uppercase"
              >
                ← BACK TO MENU
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
