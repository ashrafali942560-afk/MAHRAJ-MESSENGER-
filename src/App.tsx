import React, { useState, useEffect } from "react";
import { 
  MessageSquare, Users, Phone, Settings, LogOut, Terminal, 
  Sparkles, ShieldCheck, HelpCircle, PhoneCall, Plus, ArrowRight,
  Shield, Edit2, CheckCircle, RefreshCcw, BellRing
} from "lucide-react";
import { auth, isMockFirebase } from "./firebase";
import { 
  UserProfile, 
  ChatRoom, 
  Message, 
  StatusStory, 
  CallLog 
} from "./types";
import { 
  initializeLocalDatabase, 
  getActiveLocalUser, 
  setActiveLocalUser,
  saveUserProfile,
  getUserProfile,
  getAllUsersLocal,
  listenChats,
  createChat,
  listenMessages,
  listenStatuses,
  listenActiveCalls,
  initiateCall,
  updateCallStatus,
  STARTER_USERS
} from "./lib/state";
import { DevHub } from "./components/DevHub";
import { CallScreen } from "./components/CallScreen";
import { StatusFeed } from "./components/StatusFeed";
import { ContactSelector } from "./components/ContactSelector";
import { ChatWindow } from "./components/ChatWindow";

export default function App() {
  // Database status configs
  const [init, setInit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Login inputs
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpNotification, setOtpNotification] = useState<string | null>(null);
  
  // Registration Profile Setup inputs
  const [onboarding, setOnboarding] = useState(false);
  const [regName, setRegName] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState("");

  // Navigation tab states
  const [navTab, setNavTab] = useState<"chats" | "status" | "calls">("chats");

  // Models states synced in real-time
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [statuses, setStatuses] = useState<StatusStory[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);

  // Active overlay interfaces
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<CallLog | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showDevHub, setShowDevHub] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Avatar presets for quick profiling
  const AVATAR_PRESETS = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=150", // neon green mesh
    "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&q=80&w=150", // purple wireframe
    "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=150", // cyber neon art
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=150"  // old computers
  ];

  // Initialize DB and auth listen at startup
  useEffect(() => {
    initializeLocalDatabase();
    setAllUsers(getAllUsersLocal());

    // Check if user credentials persistent
    const storedUser = getActiveLocalUser();
    if (storedUser) {
      setUserId(storedUser.uid);
      setUserProfile(storedUser);
    }
    setInit(true);
  }, []);

  // Sync state loops based on active terminal UID
  useEffect(() => {
    if (!userId) return;

    // Listen to available users profile updates
    const localUsersInterval = setInterval(() => {
      setAllUsers(getAllUsersLocal());
    }, 4000);

    // List Chats synced
    const unsubscribeChats = listenChats(userId, (updatedRooms) => {
      setChats(updatedRooms);
    });

    // List stories statuses
    const unsubscribeStatuses = listenStatuses((updatedStatuses) => {
      setStatuses(updatedStatuses);
    });

    // List Active incoming/ringing calls
    const unsubscribeCalls = listenActiveCalls(userId, (updatedCalls) => {
      setCalls(updatedCalls);
      // If there is an active incoming ringing call not declined/missed, lift up call overlay!
      const activeRinging = updatedCalls.find(
        call => call.status === "ringing" && call.receiverId === userId
      );
      if (activeRinging) {
        setActiveCall(activeRinging);
      }
    });

    return () => {
      clearInterval(localUsersInterval);
      unsubscribeChats();
      unsubscribeStatuses();
      unsubscribeCalls();
    };
  }, [userId]);

  // Sync individual room messages if activeChatId changes
  useEffect(() => {
    if (!activeChatId) return;

    const unsubscribeMessages = listenMessages(activeChatId, (roomMsgs) => {
      setMessages(prev => ({
        ...prev,
        [activeChatId]: roomMsgs
      }));
    });

    return () => {
      unsubscribeMessages();
    };
  }, [activeChatId]);

  // --- PHONE AUTH STEP HANDLERS (SIMULATION OVERLAY) ---
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.match(/^\+?[0-9\s-]{10,15}$/)) {
      alert("Please enter a valid phone number (example: +91 99999 11111)");
      return;
    }

    // Generate random 6-digit confirmation code
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(mockCode);
    setOtpSent(true);

    // Present beautiful custom SMS notification overlay inside iframe workspace
    setTimeout(() => {
      setOtpNotification(`[SMS_GATEWAY] MAHRAJ Verification PIN is: ${mockCode}`);
    }, 1200);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode !== generatedOtp) {
      alert("Invalid OTP code. In phone auth fallback simulation, please refer to the green alert banner!");
      return;
    }

    // Auth succeeded! Generate local session UID
    const generatedUid = "user_" + phone.replace(/[^0-9]/g, "");
    setOtpNotification(null);

    // Fetch profile
    getUserProfile(generatedUid).then(existingProfile => {
      if (existingProfile) {
        setUserProfile(existingProfile);
        setActiveLocalUser(existingProfile);
        setUserId(generatedUid);
      } else {
        // Needs onboarding setup
        setRegName("");
        setRegBio("Available on MAHRAJ MESSENGER 🟢");
        setRegAvatar(AVATAR_PRESETS[0]);
        setOnboarding(true);
        setUserId(generatedUid);
      }
    });
  };

  const handleGoogleInstantSync = () => {
    // Elegant instant bypass for fast sandbox prototyping
    const demoUid = "user_demo_cohost";
    const demoProfile: UserProfile = {
      uid: demoUid,
      displayName: "Syed Ashraf (CEO)",
      photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      bio: "Pristine coding and pixel-perfect Neon Black designs. Flutter is absolute peak performance.",
      phone: "+91 91111 88888",
      isOnline: true
    };

    setUserId(demoUid);
    setUserProfile(demoProfile);
    setActiveLocalUser(demoProfile);
    saveUserProfile(demoProfile);
  };

  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;

    const newProfile: UserProfile = {
      uid: userId!,
      displayName: regName,
      phone: phone,
      bio: regBio || "Available on MAHRAJ Messenger 🟢",
      photoURL: regAvatar || AVATAR_PRESETS[0],
      isOnline: true
    };

    await saveUserProfile(newProfile);
    setUserProfile(newProfile);
    setActiveLocalUser(newProfile);
    setOnboarding(false);
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out from MAHRAJ messenger?")) {
      setActiveLocalUser(null);
      setUserId(null);
      setUserProfile(null);
      setOtpSent(false);
      setOtpCode("");
      setActiveChatId(null);
    }
  };

  // --- ACTIONS: START NEW CHATS & MAKE SIMULATED LIVE CALLS ---
  const handleStartChatWithContact = async (contactUid: string) => {
    if (!userId) return;
    const roomKey = await createChat(userId, contactUid);
    setActiveChatId(roomKey);
    setShowContacts(false);
  };

  const handleStartCall = async (type: "voice" | "video") => {
    if (!userId || !activeChatId || !userProfile) return;
    
    // Determine target call receiver which is the other participant in room
    const chatRoom = chats.find(c => c.id === activeChatId);
    if (!chatRoom) return;

    const otherUid = chatRoom.participants.find(p => p !== userId);
    if (!otherUid) return;

    const otherProfile = allUsers.find(u => u.uid === otherUid);
    if (!otherProfile) return;

    const newCallId = await initiateCall(
      userId,
      otherUid,
      userProfile.displayName,
      otherProfile.displayName,
      type
    );

    const callDetails: CallLog = {
      id: newCallId,
      callerId: userId,
      receiverId: otherUid,
      callerName: userProfile.displayName,
      receiverName: otherProfile.displayName,
      type,
      status: "ringing",
      timestamp: new Date().toISOString()
    };

    setActiveCall(callDetails);
  };

  const handleAnswerActiveCall = () => {
    if (!activeCall) return;
    updateCallStatus(activeCall.id, "connected");
    setActiveCall(prev => prev ? { ...prev, status: "connected" } : null);
  };

  const handleHangupActiveCall = (sessionDuration = 0) => {
    if (!activeCall) return;
    updateCallStatus(activeCall.id, "completed", sessionDuration);
    setActiveCall(null);

    // Save call log to local call history
    const allLogs = getActiveLocalUser() ? JSON.parse(localStorage.getItem("mahraj_messenger_calls") || "[]") : [];
    const completeCall = {
      ...activeCall,
      status: "completed" as const,
      duration: sessionDuration,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("mahraj_messenger_calls", JSON.stringify([completeCall, ...allLogs]));
  };

  // Profile detail updates
  const handleUpdateProfileBio = async (newBio: string) => {
    if (!userProfile) return;
    const updated = { ...userProfile, bio: newBio };
    await saveUserProfile(updated);
    setUserProfile(updated);
    setActiveLocalUser(updated);
  };

  const formatMsgDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  // Standard loading block till local auth values checked
  if (!init) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-xs text-[#00FF9C]">
        CRITICAL ENGINE COLD-START IN PROGRESS...
      </div>
    );
  }

  // --- VIEW: LOGIN SCREENS (PHONE / OTP SETUP FLOW) ---
  if (!userId || !userProfile || onboarding) {
    if (userId && !userProfile && !onboarding) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-xs text-[#00FF9C]">
          LOADING SECURE PROFILE MODULE...
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col justify-center items-center px-4 py-8 font-sans transition-all duration-300">
        
        {/* SMS Received Neon Notification popover popup */}
        {otpNotification && (
          <div id="sms-popover" className="fixed top-4 left-4 right-4 z-50 bg-[#0A0A0A] border-l-4 border-[#00FF9C] p-4 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.9)] animate-bounce flex items-center justify-between border border-[#00FF9C]/20">
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <div>
                <h4 className="text-[#00FF9C] font-mono text-xxs tracking-wider uppercase font-bold">SMS GATEWAY INCOMING PIN</h4>
                <p className="text-white text-xs mt-0.5 font-mono">{otpNotification}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setOtpNotification(null);
                // Auto-inject OTP code into input for convenience inside fast test loops
                setOtpCode(generatedOtp);
              }} 
              className="text-xxs font-mono bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/30 rounded px-2.5 py-1.5 transition"
            >
              AUTO // COPIED
            </button>
          </div>
        )}

        <div className="w-full max-w-sm bg-[#0A0A0A] border-2 border-[#00FF9C]/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,255,156,0.15)] p-6">
          
          {/* Logo Heading and branding */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-[#00FF9C]/10 mb-3 border border-[#00FF9C]/20">
              <MessageSquare className="w-10 h-10 text-[#00FF9C] animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-widest font-sans text-white uppercase">MAHRAJ</h1>
            <p className="text-[#00FF9C] text-xxs tracking-widest font-mono uppercase mt-1">Neon Black Messenger</p>
          </div>

          {/* Conditional view: Setup profile picture or type username */}
          {onboarding ? (
            <form onSubmit={handleRegisterProfile} className="space-y-5">
              <div className="text-center">
                <span className="text-xxs font-mono text-[#00FF9C] tracking-widest uppercase block mb-3">Onboarding // Set Profile Metadata</span>
                
                {/* Select Preset Avatars */}
                <div className="flex justify-center gap-3 mb-4">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRegAvatar(preset)}
                      className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition ${
                        regAvatar === preset ? "border-[#00FF9C] scale-105 shadow-[0_0_10px_rgba(0,255,156,0.4)]" : "border-gray-800"
                      }`}
                    >
                      <img src={preset} alt="Preset avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">Your Full Name</label>
                <input
                  id="reg-name-input"
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. Syed Ashraf"
                  className="w-full bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl p-3 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">Status Biography</label>
                <input
                  id="reg-bio-input"
                  type="text"
                  value={regBio}
                  onChange={e => setRegBio(e.target.value)}
                  placeholder="e.g. Flutter Developer Companion..."
                  className="w-full bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl p-3 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                id="register-profile-btn"
                type="submit"
                className="w-full bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black py-3 rounded-xl font-mono font-bold tracking-widest uppercase transition-all duration-200"
              >
                COMPILE MODULE // GO
              </button>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="p-3 bg-[#050505] border border-[#00FF9C]/10 rounded-xl mb-4 text-center">
                <p className="text-gray-405 text-xxs leading-relaxed">
                  Enter your mobile parameters to generate a zero-trust OTP session on MAHRAJ servers.
                </p>
              </div>

              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">Phone Number</label>
                <input
                  id="phone-login-input"
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 91111 88888"
                  className="w-full bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl p-3 text-xs text-white focus:outline-none font-mono text-center tracking-widest text-[#00FF9C]"
                />
              </div>

              <button
                id="phone-request-otp-btn"
                type="submit"
                className="w-full bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black py-3 rounded-xl font-mono font-bold tracking-widest uppercase transition duration-200"
              >
                REQUEST SECURITY PIN
              </button>

              <div className="flex items-center justify-between pt-2">
                <span className="h-[1px] bg-white/5 flex-1" />
                <span className="text-[10px] font-mono text-gray-600 px-3 uppercase">OR FAST SYNC</span>
                <span className="h-[1px] bg-white/5 flex-1" />
              </div>

              <button
                id="fast-sync-google-btn"
                type="button"
                onClick={handleGoogleInstantSync}
                className="w-full border border-[#00FF9C]/40 hover:bg-[#00FF9C]/10 text-[#00FF9C] py-2.5 rounded-xl font-mono text-xxs tracking-wider uppercase transition"
              >
                ⚡ Instant sync (Dev Bypass)
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="p-3 bg-lime-950/20 border border-lime-400/20 rounded-xl text-center">
                <p className="text-lime-400 text-xxs font-mono">
                  Verification OTP dispatched to {phone}
                </p>
              </div>

              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">6-Digit Verification PIN</label>
                <input
                  id="phone-verify-otp-input"
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="------"
                  className="w-full bg-[#050505] border border-[#00FF9C]/10 rounded-xl p-3 text-[#00FF9C] text-lg font-mono text-center tracking-[12px] focus:outline-none focus:border-[#00FF9C]"
                />
              </div>

              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="flex-1 border border-white/5 hover:border-gray-500 py-3 rounded-xl text-xs font-mono text-gray-400 transition"
                >
                  EDIT PHONE
                </button>
                <button
                  id="phone-validate-otp-btn"
                  type="submit"
                  className="flex-1 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black py-3 rounded-xl font-mono font-bold tracking-wide uppercase transition"
                >
                  VERIFY PIN //
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    );
  }

  // --- CHAT WINDOW VIEW OVERLAY ---
  if (activeChatId) {
    const room = chats.find(c => c.id === activeChatId);
    const otherParticipantUid = room?.participants.find(p => p !== userId);
    
    // If we're fallback matching bot or demo contact
    const buddyProfile = otherParticipantUid === "ai-bot" 
      ? STARTER_USERS["ai-bot"] 
      : allUsers.find(u => u.uid === otherParticipantUid) || {
          uid: otherParticipantUid || "fallback-id",
          displayName: "Secure Buddy",
          photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
          bio: "Securing MAHRAJ messenger connection...",
          phone: "+91 00000 00000",
          isOnline: true
        };

    return (
      <ChatWindow
        chatId={activeChatId}
        senderProfile={userProfile}
        receiverProfile={buddyProfile}
        messages={messages[activeChatId] || []}
        onBack={() => setActiveChatId(null)}
        onInitiateCall={handleStartCall}
      />
    );
  }

  // --- VIEWS: ROOT COMPONENT AND CORE PORTALS ---
  return (
    <div className="min-h-screen bg-[#050505] text-[#C5C6C7] flex flex-col font-sans transition-all duration-300">
      
      {/* Active Call Alert Overlay Screen */}
      {activeCall && (
        <CallScreen
          callId={activeCall.id}
          callerName={activeCall.callerName}
          receiverName={activeCall.receiverName}
          type={activeCall.type}
          direction={activeCall.callerId === userId ? "outgoing" : "incoming"}
          onAnswer={handleAnswerActiveCall}
          onHangup={handleHangupActiveCall}
        />
      )}

      {/* DevHub Drawer Overlay */}
      {showDevHub && (
        <DevHub onClose={() => setShowDevHub(false)} />
      )}

      {/* Standard Header bar */}
      <header className="bg-[#0A0A0A] border-b border-[#00FF9C]/20 px-4 py-4 flex items-center justify-between z-10 shadow-[0_4px_20px_rgba(0,255,156,0.03)]">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-[#00FF9C] animate-pulse" />
          <h1 className="text-lg font-extrabold tracking-wider text-white font-sans uppercase">MAHRAJ</h1>
        </div>

        {/* Toolbar keys */}
        <div className="flex items-center gap-3">
          <button
            id="open-devhub-btn"
            onClick={() => setShowDevHub(true)}
            title="Flutter Developer Blueprints Hub"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00FF9C]/10 border border-[#00FF9C]/30 hover:border-[#00FF9C] rounded-md text-[#00FF9C] font-mono text-xxs transition duration-150 shadow-[0_0_10px_rgba(0,255,156,0.05)] animate-pulse"
          >
            <Terminal className="w-3.5 h-3.5" /> FLUTTER DEV HUB
          </button>

          <button
            id="open-profile-btn"
            onClick={() => setShowProfileSettings(true)}
            className="w-8.5 h-8.5 rounded-full overflow-hidden border border-gray-850 hover:border-[#00FF9C] transition"
          >
            <img src={userProfile?.photoURL || AVATAR_PRESETS[0]} alt="Me" className="w-full h-full object-cover" />
          </button>
        </div>
      </header>

      {/* Profile Settings Drawer Overlay Screen */}
      {showProfileSettings && (
        <div id="settings-overlay" className="fixed inset-0 z-30 bg-[#050505]/95 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#080808] border-2 border-[#00FF9C]/40 rounded-2xl p-5 shadow-[0_0_20px_rgba(0,255,156,0.2)]">
            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-4">
              <h3 className="text-white text-xs font-bold tracking-wider uppercase font-mono text-[#00FF9C]">My Profile Settings</h3>
              <button onClick={() => setShowProfileSettings(false)} className="text-gray-405 hover:text-white font-mono text-xs">
                // Close
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#00FF9C] shadow-lg relative">
                <img src={userProfile?.photoURL || AVATAR_PRESETS[0]} alt="Profile Avatar" className="w-full h-full object-cover" />
              </div>

              <div>
                <h4 className="text-white text-sm font-bold tracking-wider">{userProfile?.displayName || "User"}</h4>
                <p className="text-[#00FF9C] text-xxs font-mono">{userProfile?.phone || ""}</p>
              </div>

              <div className="w-full font-sans">
                <label className="block text-left text-[10px] font-mono text-gray-500 uppercase mb-1">Status Quote / Bio</label>
                <input
                  id="settings-bio-input"
                  type="text"
                  defaultValue={userProfile?.bio || ""}
                  onBlur={e => handleUpdateProfileBio(e.target.value)}
                  className="w-full bg-[#050505] border border-white/5 rounded-lg p-2.5 text-xs text-white text-center focus:outline-none focus:border-[#00FF9C]"
                />
                <span className="text-[9px] text-gray-650 font-mono text-center block mt-1">Changes are saved to database on input blur</span>
              </div>

              <div className="pt-3 w-full border-t border-white/5 flex gap-2">
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="flex-1 py-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/40 hover:border-red-600 font-mono text-xxs rounded transition uppercase"
                >
                  <LogOut className="w-3.5 h-3.5 inline mr-1" /> Terminate Session
                </button>
                <button
                  onClick={() => setShowProfileSettings(false)}
                  className="flex-1 py-2 border border-white/5 hover:border-gray-500 rounded text-xxs font-mono text-gray-300 transition"
                >
                  DONE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for chats search */}
      {navTab === "chats" && (
        <button
          id="fab-contacts-trigger"
          onClick={() => setShowContacts(true)}
          className="fixed bottom-6 right-6 z-20 w-14 h-14 bg-[#00FF9C] hover:bg-[#00D1FF] rounded-xl shadow-[0_4px_15px_rgba(0,255,156,0.3)] flex items-center justify-center text-black cursor-pointer transition transform duration-200 hover:scale-105"
        >
          <Plus className="w-7 h-7 text-black font-bold" />
        </button>
      )}

      {/* Top Tabs (Chats, Status/Stories, Calls) */}
      <div className="bg-[#0A0A0A] border-b border-white/5 flex font-mono text-xxs uppercase tracking-wider text-center font-bold z-10">
        <button
          id="tab-chats-btn"
          onClick={() => setNavTab("chats")}
          className={`flex-1 py-3 border-b-2 transition ${
            navTab === "chats" ? "border-[#00FF9C] text-[#00FF9C]" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Chats ({chats.length})
        </button>
        <button
          id="tab-status-btn"
          onClick={() => setNavTab("status")}
          className={`flex-1 py-3 border-b-2 transition ${
            navTab === "status" ? "border-[#00FF9C] text-[#00FF9C]" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Status ({statuses.length})
        </button>
        <button
          id="tab-calls-btn"
          onClick={() => setNavTab("calls")}
          className={`flex-1 py-3 border-b-2 transition ${
            navTab === "calls" ? "border-[#00FF9C] text-[#00FF9C]" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Live Calls
        </button>
      </div>

      {/* View router depending on standard tab selected */}
      <main className="flex-1 bg-[#050505] py-1.5">
        
        {/* TAB 1: CHATS VIEW */}
        {navTab === "chats" && (
          <div id="chats-tab-view" className="px-3.5 space-y-1.5">
            {chats.length === 0 ? (
              <div className="text-center py-24 text-gray-500 font-mono text-xs max-w-xs mx-auto space-y-4">
                <div className="w-14 h-14 rounded-full border border-white/5 bg-[#0A0A0A] flex items-center justify-center mx-auto text-xl animate-bounce">
                  ⚡
                </div>
                <p>No compiled terminal channels. Press the glowing green launch key below to spark a chat thread!</p>
                <button
                  onClick={() => setShowContacts(true)}
                  className="px-3 py-1.5 border border-[#00FF9C]/40 hover:border-[#00FF9C] rounded font-mono text-xxs text-[#00FF9C] bg-[#00FF9C]/5 hover:bg-[#00FF9C]/10 transition"
                >
                  START SECURE CHANNEL // +
                </button>
              </div>
            ) : (
              chats.map((room) => {
                const otherUid = room.participants.find(p => p !== userId);
                const isBot = otherUid === "ai-bot";
                
                // fallback matching profiles
                const profileObj = isBot 
                  ? STARTER_USERS["ai-bot"] 
                  : allUsers.find(u => u.uid === otherUid) || {
                      uid: otherUid || "fallback-id",
                      displayName: "Secure Terminal",
                      photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
                      bio: "Secured mesh node",
                      phone: "+91 00000 00000",
                      isOnline: false
                    };

                // Find unread message counts in cache
                const roomMsgs = messages[room.id] || [];
                const unreadCount = roomMsgs.filter(m => m.senderId !== userId && m.status !== "read").length;

                return (
                  <div
                    id={`chat-room-item-${room.id}`}
                    key={room.id}
                    onClick={() => setActiveChatId(room.id)}
                    className="bg-[#0A0A0A] p-3 rounded-xl border border-white/5 hover:border-[#00FF9C]/30 hover:bg-[#0A0A0A]/50 cursor-pointer flex items-center justify-between transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <img src={profileObj.photoURL} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-[#050505]" />
                        {profileObj.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A] animate-pulse" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5 uppercase">
                          {profileObj.displayName}
                          {isBot && (
                            <span className="bg-[#00FF9C]/15 text-[#00FF9C] text-[8px] font-mono border border-[#00FF9C]/30 rounded px-1.5">AI</span>
                          )}
                        </h4>
                        <p className="text-gray-400 text-xxs font-sans max-w-[190px] truncate mt-0.5" title={room.lastMessage}>
                          {room.lastMessageSender === userId ? "You: " : ""}{room.lastMessage}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 font-mono">
                      <span className="text-[9px] text-[#00D1FF]">{room.lastMessageTime ? formatMsgDate(room.lastMessageTime) : ""}</span>
                      {unreadCount > 0 && (
                        <span className="w-4.5 h-4.5 bg-[#00FF9C] text-black rounded-full text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(0,255,156,0.5)]">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: METADATA STATUS STORIES FEED */}
        {navTab === "status" && (
          <StatusFeed
            statuses={statuses}
            currentUserId={userId || ""}
            currentUserName={userProfile?.displayName || "User"}
            currentUserAvatar={userProfile?.photoURL || AVATAR_PRESETS[0]}
          />
        )}

        {/* TAB 3: PHONE VOICE & VIDEO CALL LOGGER */}
        {navTab === "calls" && (
          <div id="calls-tab-view" className="px-3.5 space-y-1.5 font-sans">
            <div className="flex items-center justify-between border-b border-[#00FF9C]/10 pb-1.5 mb-3 font-mono text-xxs tracking-widest text-[#00FF9C] uppercase">
              <span>TRANSMISSION HISTORY (LOGS)</span>
            </div>

            {/* Simulated Calls cache check */}
            {(() => {
              const staticCallLogs = [
                {
                  id: "call-demo-1",
                  callerId: "syed-sahab",
                  receiverId: userId || "",
                  callerName: "Syed Ashraf (CEO)",
                  receiverName: userProfile?.displayName || "User",
                  type: "video" as const,
                  status: "missed" as const,
                  timestamp: new Date(Date.now() - 7200000).toISOString()
                },
                {
                  id: "call-demo-2",
                  callerId: userId || "",
                  receiverId: "ai-bot",
                  callerName: userProfile?.displayName || "User",
                  receiverName: "MAHRAJ AI Engine",
                  type: "voice" as const,
                  status: "completed" as const,
                  duration: 182,
                  timestamp: new Date(Date.now() - 14400000).toISOString()
                }
              ];

              return staticCallLogs.map((log) => {
                const isMissed = log.status === "missed";
                const isOther = log.callerId !== userId;
                return (
                  <div
                    id={`call-log-item-${log.id}`}
                    key={log.id}
                    className="bg-[#0A0A0A] p-3 rounded-xl border border-white/5 hover:border-[#00FF9C]/15 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full border border-white/5 bg-gray-950/40 flex items-center justify-center">
                        <PhoneCall className={`w-4 h-4 ${isMissed ? "text-red-500 animate-pulse" : "text-[#00FF9C]"}`} />
                      </div>
                      <div>
                        <h4 className="text-white text-xs font-semibold tracking-wide">
                          {isOther ? log.callerName : log.receiverName}
                        </h4>
                        <p className="text-gray-400 text-xxs font-mono mt-0.5 uppercase flex items-center gap-1">
                          <span className={isMissed ? "text-red-500" : "text-lime-500"}>
                            {isMissed ? "MISSED ATTEMPT" : "COMPLETED WORK"}
                          </span>
                          {log.duration ? `• ${Math.floor(log.duration / 60)}m ${log.duration % 60}s` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-right text-xxs text-gray-500">
                      <span>{formatMsgDate(log.timestamp)}</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

      </main>

      {/* Contacts selection modal overlay */}
      {showContacts && (
        <ContactSelector
          contacts={allUsers}
          currentUserId={userId}
          onSelectContact={handleStartChatWithContact}
          onClose={() => setShowContacts(false)}
        />
      )}
    </div>
  );
}
