import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, Users, Phone, Settings, LogOut, Terminal, 
  Sparkles, ShieldCheck, HelpCircle, PhoneCall, Plus, ArrowRight,
  Shield, Edit2, CheckCircle, RefreshCcw, BellRing, Lock, Check, Trash2,
  Search, X
} from "lucide-react";
import { auth, isMockFirebase } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
  }
}
import { 
  UserProfile, 
  ChatRoom, 
  GroupRoom,
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
  listenAllUsers,
  listenChats,
  createChat,
  listenMessages,
  listenStatuses,
  deleteStatusStory,
  deleteChat,
  deleteGroup,
  listenActiveCalls,
  initiateCall,
  updateCallStatus,
  listenCall,
  STARTER_USERS,
  listenGroups,
  createGroup
} from "./lib/state";
import { DevHub } from "./components/DevHub";
import { CallScreen } from "./components/CallScreen";
import { StatusFeed } from "./components/StatusFeed";
import { ContactSelector } from "./components/ContactSelector";
import { ChatWindow } from "./components/ChatWindow";
import { SettingsPanel } from "./components/SettingsPanel";
import { useTranslation } from "./lib/i18n";
import { useNativeBackNavigation } from "./hooks/useNativeBackNavigation";

export default function App() {
  const { t, currentLanguage } = useTranslation();
  
  // Database status configs
  const [init, setInit] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Splash Screen automatic duration timer
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => clearTimeout(splashTimer);
  }, []);
  
  // Login inputs
  const [phone, setPhone] = useState("+91 ");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpNotification, setOtpNotification] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [forceMockMode, setForceMockMode] = useState(false);
  const [systemBanner, setSystemBanner] = useState<{ title: string; message: string; type: "error" | "warning" | "success" } | null>(null);
  
  // Registration Profile Setup inputs
  const [onboarding, setOnboarding] = useState(false);
  const [regName, setRegName] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState("");

  // Navigation tab states
  const [navTab, setNavTab] = useState<"chats" | "status" | "calls">("chats");
  const [searchText, setSearchText] = useState("");

  // Models states synced in real-time
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [groups, setGroups] = useState<GroupRoom[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [statuses, setStatuses] = useState<StatusStory[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);

  const isFirstLoad = useRef(true);
  const lastNotifiedTimeRef = useRef<Record<string, string>>({});
  const lastNotifiedGroupTimeRef = useRef<Record<string, string>>({});

  // Real-time Push & Haptic Notification handler
  useEffect(() => {
    if (!userId || chats.length === 0) return;

    // Proactively register Notification permissions if possible
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(console.error);
    }

    chats.forEach((room) => {
      const lastMsgTime = room.lastMessageTime;
      if (!lastMsgTime) return;

      const isIncoming = room.lastMessageSender !== userId;
      const prevTime = lastNotifiedTimeRef.current[room.id];

      // Check for a real-time incoming update
      if (isIncoming && !isFirstLoad.current && prevTime && prevTime !== lastMsgTime) {
        const otherUid = room.participants.find(p => p !== userId);
        const isBot = otherUid === "ai-bot";
        const profileObj = isBot 
          ? STARTER_USERS["ai-bot"] 
          : allUsers.find(u => u.uid === otherUid);
        
        const senderName = profileObj?.displayName || "Secure Client Node";
        const messageBody = room.lastMessage;

        // Native Browser alert (Mobile + Desktop matching user description)
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(senderName, {
              body: messageBody,
              icon: profileObj?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"
            });
          } catch (e) {
            console.warn("FCM Fallback: Native notification build blocked: ", e);
          }
        }

        // Mobile alert system: standard device physical Vibration
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([150, 80, 150]);
          } catch (e) {
            console.warn("Vibrate not permitted inline in iframe", e);
          }
        }

        // Elegant floating visual inline notification bar fallback inside application
        setOtpNotification(`💬 Msg from ${senderName}: "${messageBody}"`);
      }

      lastNotifiedTimeRef.current[room.id] = lastMsgTime;
    });

    if (chats.length > 0) {
      isFirstLoad.current = false;
    }
  }, [chats, userId, allUsers]);

  // Real-time Group Notifications handler
  useEffect(() => {
    if (!userId || groups.length === 0) return;

    groups.forEach((group) => {
      const lastMsgTime = group.lastMessageTime;
      if (!lastMsgTime) return;

      const isIncoming = group.lastMessageSender !== userId;
      const prevTime = lastNotifiedGroupTimeRef.current[group.id];

      if (isIncoming && !isFirstLoad.current && prevTime && prevTime !== lastMsgTime) {
        const groupName = group.name;
        const messageBody = group.lastMessage;
        
        const senderProfile = allUsers.find(u => u.uid === group.lastMessageSender);
        const senderName = senderProfile?.displayName || "Encrypted Node";

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`👥 ${groupName}`, {
              body: `${senderName}: ${messageBody}`,
              icon: group.avatar
            });
          } catch (e) {
            console.warn("FCM Fallback: Group notification block: ", e);
          }
        }

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([150, 80, 150]);
          } catch (e) {
            console.warn("Vibration failed inside frame workspace environment.", e);
          }
        }

        setOtpNotification(`👥 Group ${groupName}: "${senderName}: ${messageBody}"`);
      }

      lastNotifiedGroupTimeRef.current[group.id] = lastMsgTime;
    });
  }, [groups, userId, allUsers]);

  // Group UI & view state variables
  const [activeChatType, setActiveChatType] = useState<"private" | "group">("private");
  const [chatTab, setChatTab] = useState<"private" | "group">("private");
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  // Active overlay interfaces
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<CallLog | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showDevHub, setShowDevHub] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Hook up physical back button and gesture navigation support
  useNativeBackNavigation({
    activeChatId,
    setActiveChatId,
    showProfileSettings,
    setShowProfileSettings,
    showCreateGroupModal,
    setShowCreateGroupModal
  });

  // Avatar presets
  const AVATAR_PRESETS = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=150", 
    "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&q=80&w=150", 
    "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=150", 
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=150"  
  ];

  // Initialize DB and auth persistent session
  useEffect(() => {
    initializeLocalDatabase();
    setAllUsers(getAllUsersLocal());

    // Check persistent active log
    const storedUser = getActiveLocalUser();
    if (storedUser) {
      setUserId(storedUser.uid);
      setUserProfile(storedUser);
    }
    setInit(true);
  }, []);

  // Sync state loops of live Firestore users, channels, calls, statuses
  useEffect(() => {
    if (!userId) return;

    // Users
    const unsubscribeUsers = listenAllUsers((updatedUsers) => {
      setAllUsers(updatedUsers);
    });

    // Chats
    const unsubscribeChats = listenChats(userId, (updatedRooms) => {
      setChats(updatedRooms);
    });

    // Groups
    const unsubscribeGroups = listenGroups(userId, (updatedGroups) => {
      setGroups(updatedGroups);
    });

    // Status feeds
    const unsubscribeStatuses = listenStatuses((updatedStatuses) => {
      setStatuses(updatedStatuses);
    });

    // Active ringing signaling events
    const unsubscribeCalls = listenActiveCalls(userId, (updatedCalls) => {
      setCalls(updatedCalls);
      const activeRinging = updatedCalls.find(
        call => call.status === "ringing" && call.receiverId === userId
      );
      if (activeRinging) {
        setActiveCall(activeRinging);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeChats();
      unsubscribeGroups();
      unsubscribeStatuses();
      unsubscribeCalls();
    };
  }, [userId]);

  // Messages syncing loop per active conversation
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

  // OTP triggers
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemBanner(null);

    if (!phone.trim()) {
      setSystemBanner({
        title: "Input Required",
        message: "Please enter a valid phone number (example: +91 99999 11111)",
        type: "warning"
      });
      return;
    }

    // Clean space delimiters
    let rawPhone = phone.trim().replace(/[\s-]/g, "");
    if (!rawPhone.startsWith("+")) {
      if (rawPhone.startsWith("91") && rawPhone.length >= 12) {
        rawPhone = "+" + rawPhone;
      } else {
        rawPhone = "+91" + rawPhone;
      }
    }
    let formattedPhone = rawPhone;

    if (formattedPhone.length < 11) {
      setSystemBanner({
        title: "Invalid Number",
        message: "Phone number is too short! Format correctly: e.g. +91 99999 11111",
        type: "warning"
      });
      return;
    }

    if (!formattedPhone.match(/^\+[0-9]{10,15}$/)) {
      setSystemBanner({
        title: "Invalid Format",
        message: "Invalid country structure. Format carefully: e.g. +919999911111",
        type: "warning"
      });
      return;
    }

    if (isMockFirebase || forceMockMode) {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockCode);
      setOtpSent(true);
      setTimeout(() => {
        setOtpNotification(`[SMS_GATEWAY] MAHRAJ Verification PIN is: ${mockCode}`);
      }, 1200);
      return;
    }

    try {
      setOtpNotification("[SYS] Initializing secure Recaptcha session...");

      let containerElement = document.getElementById('recaptcha-container');
      if (!containerElement) {
        containerElement = document.createElement('div');
        containerElement.id = 'recaptcha-container';
        containerElement.style.position = 'absolute';
        containerElement.style.opacity = '0';
        containerElement.style.pointerEvents = 'none';
        containerElement.style.width = '1px';
        containerElement.style.height = '1px';
        containerElement.style.overflow = 'hidden';
        document.body.appendChild(containerElement);
      }

      if (!window.recaptchaVerifier) {
        containerElement.innerHTML = ''; 
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerElement, {
          size: 'invisible',
          callback: () => {
            console.log("[MAHRAJ Auth] Invisible reCAPTCHA evaluated.");
          }
        });
      }

      console.log("[MAHRAJ Auth] Dispatching SMS payload to:", formattedPhone);
      const result = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(result);
      window.confirmationResult = result;
      setOtpSent(true);
      setOtpNotification(`[SMS_GATEWAY] Real Firebase OTP pin sent to ${formattedPhone}`);
      
      setTimeout(() => setOtpNotification(null), 7000);
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const isBillingDisabled = 
        errorMsg.toLowerCase().includes("billing-not-enabled") || 
        errorMsg.toLowerCase().includes("billing") ||
        errorMsg.toLowerCase().includes("quota") ||
        errorMsg.toLowerCase().includes("limit") ||
        (error.code && (
          error.code.includes("billing-not-enabled") || 
          error.code.includes("quota-exceeded")
        ));
      const isTooShort = errorMsg.toUpperCase().includes("TOO_SHORT");
      const isInvalidOrShort = errorMsg.includes("invalid-phone-number") || isTooShort;

      if (isBillingDisabled) {
        console.warn("Firebase Phone Auth: SMS dispatch limits or billing is disabled. Activating sandbox bypass.");
        
        if (window.recaptchaVerifier) {
          try {
            const v = window.recaptchaVerifier;
            window.recaptchaVerifier = null;
            if (v && typeof v.clear === "function") {
              v.clear();
            }
          } catch (e) {
            console.warn("Recaptcha error cleanup warn:", e);
          }
        }

        setForceMockMode(true);
        setSystemBanner({
          title: "Simulation Autoplay Bypass",
          message: "The Firebase project's SMS thresholds have been reached. Your companion has automatically activated the sandbox SMS overlay pin generator below.",
          type: "warning"
        });
        
        const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedOtp(mockCode);
        setOtpSent(true);
        setTimeout(() => {
          setOtpNotification(`[SMS_GATEWAY] MAHRAJ Verification PIN is: ${mockCode}`);
        }, 1200);
        return;
      } else {
        console.error("Firebase Phone Auth Connection Alert:", error);
      }

      if (isInvalidOrShort) {
        setSystemBanner({
          title: "Number Format Block",
          message: "The specified phone number is too short or invalid. Ensure you append your country code (e.g. +91 99999 11111).",
          type: "error"
        });
      } else {
        setSystemBanner({
          title: "Connection Alert",
          message: `SMS Dispatch failed: ${errorMsg}. Sandbox bypass can be triggered manually in DEV HUB.`,
          type: "error"
        });
      }
      setOtpNotification(null);
      
      if (window.recaptchaVerifier) {
        try {
          const v = window.recaptchaVerifier;
          window.recaptchaVerifier = null;
          if (v && typeof v.clear === "function") {
            v.clear();
          }
        } catch (e) {
          console.warn("Recaptcha error cleanup warn:", e);
        }
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemBanner(null);

    if (!otpCode.trim() || otpCode.length !== 6) {
      setSystemBanner({
        title: "Validation Defect",
        message: "Please specify a complete 6-digit verification code.",
        type: "warning"
      });
      return;
    }

    if (isMockFirebase || forceMockMode) {
      if (otpCode !== generatedOtp) {
        setSystemBanner({
          title: "Verification Fail",
          message: "Invalid OTP code. In phone auth fallback simulation, please refer to the green alert banner!",
          type: "error"
        });
        return;
      }

      const generatedUid = "user_" + phone.replace(/[^0-9]/g, "");
      setOtpNotification(null);

      getUserProfile(generatedUid).then(existingProfile => {
        if (existingProfile) {
          setUserProfile(existingProfile);
          setActiveLocalUser(existingProfile);
          setUserId(generatedUid);
        } else {
          setRegName("");
          setRegBio("Available on MAHRAJ MESSENGER 🟢");
          setRegAvatar(AVATAR_PRESETS[0]);
          setOnboarding(true);
          setUserId(generatedUid);
        }
      });
      return;
    }

    const activeConfirm = confirmationResult || window.confirmationResult;
    if (!activeConfirm) {
      setSystemBanner({
        title: "Session Expired",
        message: "Verification session expired. Please request a new security code.",
        type: "error"
      });
      setOtpSent(false);
      return;
    }

    try {
      setOtpNotification("[SYS] Decrypting confirmation handshake...");
      const credential = await activeConfirm.confirm(otpCode);
      const firebaseUser = credential.user;

      if (firebaseUser) {
        const uid = firebaseUser.uid;
        setOtpNotification(null);

        getUserProfile(uid).then(existingProfile => {
          if (existingProfile) {
            setUserProfile(existingProfile);
            setActiveLocalUser(existingProfile);
            setUserId(uid);
          } else {
            setRegName("");
            setRegBio("Available on MAHRAJ MESSENGER 🟢");
            setRegAvatar(AVATAR_PRESETS[0]);
            setOnboarding(true);
            setUserId(uid);
          }
        });
      }
    } catch (error: any) {
      console.error("Firebase Code Verification Error:", error);
      setSystemBanner({
        title: "Handshake Error",
        message: `Cryptographic PIN verify failed: ${error.message || error}`,
        type: "error"
      });
      setOtpNotification(null);
    }
  };

  const handleGoogleInstantSync = () => {
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
    setActiveLocalUser(null);
    setUserId(null);
    setUserProfile(null);
    setOtpSent(false);
    setOtpCode("");
    setActiveChatId(null);
    setShowProfileSettings(false);
  };

  const handleStartChatWithContact = async (contactUid: string) => {
    if (!userId) return;
    const roomKey = await createChat(userId, contactUid);
    setActiveChatId(roomKey);
    setShowContacts(false);
  };

  const handleStartCall = async (type: "voice" | "video") => {
    if (!userId || !activeChatId || !userProfile) return;
    
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

    const allLogs = getActiveLocalUser() ? JSON.parse(localStorage.getItem("mahraj_messenger_calls") || "[]") : [];
    const completeCall = {
      ...activeCall,
      status: "completed" as const,
      duration: sessionDuration,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("mahraj_messenger_calls", JSON.stringify([completeCall, ...allLogs]));
  };

  const formatMsgDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  if (showSplash) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-sans tracking-wide relative overflow-hidden select-none">
        {/* Ambient neon backdrops */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-[#00FF9C]/5 rounded-full blur-[90px] pointer-events-none animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] bg-[#00D1FF]/5 rounded-full blur-[70px] pointer-events-none"></div>

        {/* Scan lines & matrix style grids */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.3)_50%),_linear-gradient(90deg,_rgba(0,255,156,0.03),_rgba(0,209,255,0.02),_rgba(0,255,156,0.03))] bg-[size:100%_4px,_6px_100%] pointer-events-none opacity-50"></div>

        {/* Brand container */}
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
          {/* Neon pulsating launcher frame */}
          <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
            {/* Double ring ripples */}
            <div className="absolute inset-0 rounded-3xl border-2 border-[#00FF9C]/20 animate-ping opacity-60" style={{ animationDuration: '2.5s' }}></div>
            <div className="absolute inset-2 rounded-3xl border border-[#00D1FF]/30 anim-pulse"></div>

            {/* Main high-contrast emblem */}
            <div className="relative w-20 h-20 bg-black/95 border-2 border-[#00FF9C] rounded-3xl flex items-center justify-center shadow-[0_0_35px_rgba(0,255,156,0.3)] transition-all duration-300">
              <MessageSquare className="w-10 h-10 text-[#00FF9C] animate-pulse" />
              {/* Core mini node indicator */}
              <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-[#00D1FF] rounded-full border-2 border-[#050505] flex items-center justify-center shadow-[0_0_12px_rgba(0,209,255,0.9)]">
                <div className="w-1.5 h-1.5 bg-black rounded-full animate-ping"></div>
              </div>
            </div>
          </div>

          {/* Letter spacing title header */}
          <h1 className="text-4xl font-extrabold tracking-[0.3em] text-white uppercase text-center pl-[0.3em] relative">
            M<span className="text-[#00FF9C] drop-shadow-[0_0_8px_rgba(0,255,156,0.6)]">A</span>H<span className="text-[#00D1FF] drop-shadow-[0_0_8px_rgba(0,209,255,0.6)]">R</span>AJ
          </h1>

          <div className="mt-3.5 h-[2px] w-28 bg-gradient-to-r from-transparent via-[#00FF9C]/80 to-transparent relative overflow-hidden">
            <div className="absolute top-0 left-0 h-full w-1/2 bg-[#00D1FF] animate-bounce" style={{ animationDuration: '2.2s' }}></div>
          </div>

          <p className="mt-4 text-[10px] font-mono text-gray-500 uppercase tracking-[0.45em] animate-pulse">
            {t("tagline") || "SECURE QUANTUM LINK"}
          </p>
        </div>

        {/* Bottom system ready badge */}
        <div className="absolute bottom-12 left-0 right-0 text-center z-10">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-[#0A0A0A]/90 border border-white/5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            <div className="w-2 h-2 rounded-full bg-[#00FF9C] animate-ping"></div>
            <span className="text-[9px] font-mono tracking-widest text-[#00FF9C] uppercase font-bold">SYSTEM ONLINE</span>
          </div>
        </div>
      </div>
    );
  }

  if (!init) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-xs text-[#00FF9C]">
        CRITICAL ENGINE COLD-START IN PROGRESS...
      </div>
    );
  }

  // --- WELCOME/AUTHENTICATION LOGIN FLOWS (SUPPORT TRANSLATION) ---
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
                setOtpCode(generatedOtp);
              }} 
              className="text-xxs font-mono bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/30 rounded px-2.5 py-1.5 transition cursor-pointer"
            >
              AUTO FILL
            </button>
          </div>
        )}

        <div className="w-full max-w-sm bg-[#0A0A0A] border-2 border-[#00FF9C]/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,255,156,0.15)] p-6">
          
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-[#00FF9C]/10 mb-3 border border-[#00FF9C]/20">
              <MessageSquare className="w-10 h-10 text-[#00FF9C] animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-widest font-sans text-white uppercase">{t("welcome")}</h1>
            <p className="text-[#00FF9C] text-xxs tracking-wider font-mono uppercase mt-1">{t("tagline")}</p>
          </div>

          {systemBanner && (
            <div id="welcome-system-banner" className="mb-4 p-3.5 bg-yellow-950/20 border border-yellow-500/25 rounded-2xl text-[11px] leading-relaxed text-gray-300 relative animate-in fade-in duration-300">
              <span className="font-mono text-[9px] text-yellow-400 font-bold tracking-widest uppercase block animate-pulse mb-1">
                ⚠️ {systemBanner.title}
              </span>
              <span>{systemBanner.message}</span>
              <button 
                onClick={() => setSystemBanner(null)} 
                className="absolute top-1.5 right-2 px-1 text-gray-500 hover:text-white font-mono text-xs cursor-pointer select-none"
              >
                ×
              </button>
            </div>
          )}

          {onboarding ? (
            <form onSubmit={handleRegisterProfile} className="space-y-4">
              <div className="text-center">
                <span className="text-xxs font-mono text-[#00FF9C] tracking-widest uppercase block mb-3">{t("onboarding_title")}</span>
                
                <div className="flex justify-center gap-3 mb-4">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRegAvatar(preset)}
                      className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition ${
                        regAvatar === preset ? "border-[#00FF9C] scale-105 shadow-[0_0_10px_rgba(0,255,156,0.4)]" : "border-gray-850"
                      }`}
                    >
                      <img src={preset} alt="Preset avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">{t("onboarding_name")}</label>
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
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">{t("onboarding_bio")}</label>
                <input
                  id="reg-bio-input"
                  type="text"
                  value={regBio}
                  onChange={e => setRegBio(e.target.value)}
                  placeholder="e.g. Developer..."
                  className="w-full bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl p-3 text-xs text-white focus:outline-none block"
                />
              </div>

              <button
                id="register-profile-btn"
                type="submit"
                className="w-full bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black py-3 rounded-xl font-mono font-bold tracking-widest uppercase transition-all duration-200 cursor-pointer"
              >
                {t("onboarding_btn")} // GO
              </button>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">{t("phone_input_label")}</label>
                <input
                  id="phone-login-input"
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t("phone_placeholder")}
                  className="w-full bg-[#050505] border border-white/5 focus:border-[#00FF9C] rounded-xl p-3 text-xs text-white focus:outline-none font-mono text-center tracking-widest text-[#00FF9C]"
                />
              </div>

              <button
                id="phone-request-otp-btn"
                type="submit"
                className="w-full bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black py-3 rounded-xl font-mono font-bold tracking-widest uppercase transition duration-200 cursor-pointer"
              >
                {t("request_otp_btn")}
              </button>

              <div className="flex items-center justify-between pt-2">
                <span className="h-[1px] bg-white/5 flex-1" />
                <span className="text-[10px] font-mono text-gray-650 px-3 uppercase">OR FAST SYNC</span>
                <span className="h-[1px] bg-white/5 flex-1" />
              </div>

              <button
                id="fast-sync-google-btn"
                type="button"
                onClick={handleGoogleInstantSync}
                className="w-full border border-[#00FF9C]/40 hover:bg-[#00FF9C]/10 text-[#00FF9C] py-2.5 rounded-xl font-mono text-xxs tracking-wider uppercase transition cursor-pointer mb-2"
              >
                ⚡ Instant sync (Dev Bypass)
              </button>

              <button
                id="open-sandbox-otp-panel-btn"
                type="button"
                onClick={() => setShowDevHub(true)}
                className="w-full bg-[#11241E] text-[#00FF9C] hover:bg-[#00FF9C]/10 border-2 border-[#00FF9C]/25 hover:border-[#00FF9C]/60 py-2.5 rounded-xl font-mono text-xxs tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5 font-bold shadow-[0_0_15px_rgba(0,255,156,0.1)] hover:shadow-[0_0_25px_rgba(0,255,156,0.2)]"
              >
                🔑 Open Sandbox SMS & OTP Generator
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-lime-950/20 border border-lime-400/20 rounded-xl text-center">
                <p className="text-lime-400 text-xxs font-mono">
                  OTP dispatched to {phone}
                </p>
              </div>

              <div>
                <label className="block text-xxs font-mono uppercase text-gray-500 mb-1">{t("enter_otp_label")}</label>
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
                  className="flex-1 border border-white/5 hover:border-gray-500 py-3 rounded-xl text-xs font-mono text-gray-400 transition cursor-pointer"
                >
                  {t("change_phone")}
                </button>
                <button
                  id="phone-validate-otp-btn"
                  type="submit"
                  className="flex-1 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black py-3 rounded-xl font-mono font-bold tracking-wide uppercase transition cursor-pointer"
                >
                  {t("validate_otp_btn")}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    );
  }

  // --- RESOLVE BUDDY CHAT WINDOW CONTENT (DETERMINE SELECTED CHAT DATA) ---
  const getBuddyProfile = () => {
    if (!activeChatId) return null;
    if (activeChatId.startsWith("group_")) {
      const groupDoc = groups.find(g => g.id === activeChatId);
      if (groupDoc) {
        return {
          uid: groupDoc.id,
          displayName: groupDoc.name,
          photoURL: groupDoc.avatar || "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&q=80&w=200",
          bio: `${groupDoc.members.length} members`,
          phone: "Group Channel",
          isOnline: true
        };
      }
    }
    const room = chats.find(c => c.id === activeChatId);
    const otherParticipantUid = room?.participants.find(p => p !== userId);
    return otherParticipantUid === "ai-bot" 
      ? STARTER_USERS["ai-bot"] 
      : allUsers.find(u => u.uid === otherParticipantUid) || {
          uid: otherParticipantUid || "fallback-id",
          displayName: "Secure Terminal",
          photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
          bio: "Securing mesh node connection...",
          phone: "+91 00000 00000",
          isOnline: true
        };
  };

  const buddyProfile = getBuddyProfile();

  // --- MAIN LAYOUT CONSOLE -- BENTO ADAPTIVE DUAL SPLIT INTERFACE ---
  return (
    <div className="min-h-screen bg-[#050505] text-[#C5C6C7] flex flex-col font-sans transition-all duration-300 relative">
      
      {/* Incoming Ringing Voice/Video Signal overlay */}
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
        <DevHub 
          onClose={() => setShowDevHub(false)} 
          activePhone={phone || "+91 99999 11111"}
          onInjectOtp={(targetPhone, code) => {
            setPhone(targetPhone);
            setGeneratedOtp(code);
            setOtpSent(true);
            setForceMockMode(true);
            setOtpNotification(`[SMS_GATEWAY] MAHRAJ Verification PIN is: ${code}`);
            setSystemBanner({
              title: "Sandbox OTP Injected",
              message: `Simulated OTP pin (${code}) generated for subscriber: ${targetPhone}. Sandbox bypass active.`,
              type: "success"
            });
          }}
        />
      )}

      {/* Modern Profile Settings Panel Component */}
      {showProfileSettings && (
        <SettingsPanel
          userProfile={userProfile}
          onClose={() => setShowProfileSettings(false)}
          onUpdateProfile={(updated) => {
            setUserProfile(updated);
            setActiveLocalUser(updated);
          }}
          onLogout={handleLogout}
          avatarPresets={AVATAR_PRESETS}
          forceMockMode={forceMockMode}
          onSetForceMockMode={setForceMockMode}
        />
      )}

      {/* Dual Bento Grid Wrapper Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto overflow-hidden relative self-stretch h-[100vh]">
        
        {/* SIDEBAR BLOCK: Left area. Visible always on wide viewports, hidden on mobile screens if a conversation is open */}
        <div className={`w-full md:w-[380px] md:border-r md:border-white/5 flex flex-col h-full bg-[#050505] transition-all ${
          activeChatId ? "hidden md:flex" : "flex"
        }`}>
          
          {/* Header Bar */}
          <header className="p-4 bg-[#0A0A0A] border-b border-[#00FF9C]/10 flex items-center justify-between shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#00FF9C]" />
              <h1 className="text-md font-extrabold tracking-widest text-white uppercase">{t("app_title")}</h1>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end">
              {/* Cybernetic Search Chat facility in place of Dev Hub */}
              <div className="relative flex items-center bg-black/50 border border-[#00FF9C]/20 focus-within:border-[#00FF9C] rounded-xl px-2.5 py-1.5 transition-all duration-300 shadow-[0_0_15px_rgba(0,255,156,0.05)]">
                <Search className="w-3.5 h-3.5 text-[#00FF9C]/80 mr-1.5 shrink-0" />
                <input
                  id="chat-search-input"
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search Chat..."
                  className="bg-transparent text-[10px] font-mono text-white placeholder-gray-600 focus:outline-none w-16 sm:w-20 md:w-24 focus:w-28 md:focus:w-32 transition-all duration-300"
                />
                {searchText && (
                  <button 
                    onClick={() => setSearchText("")} 
                    className="ml-1 text-[#00FF9C] hover:text-white shrink-0"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <button
                id="profile-settings-btn"
                onClick={() => setShowProfileSettings(true)}
                className="w-8 h-8 rounded-full overflow-hidden border border-[#00FF9C]/40 hover:border-[#00FF9C] transition cursor-pointer shrink-0"
                title="System settings"
              >
                <img src={userProfile?.photoURL || AVATAR_PRESETS[0]} alt="Me" className="w-full h-full object-cover" />
              </button>
            </div>
          </header>

          {/* Navigation Tab Toggles */}
          <div className="bg-[#0A0A0A] border-b border-white/5 flex font-mono text-xxs uppercase tracking-wider text-center font-bold z-10 select-none">
            <button
              onClick={() => setNavTab("chats")}
              className={`flex-1 py-3.5 border-b-2 transition cursor-pointer ${
                navTab === "chats" ? "border-[#00FF9C] text-[#00FF9C]" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t("chats_tab")} ({chats.length})
            </button>
            <button
              onClick={() => setNavTab("status")}
              className={`flex-1 py-3.5 border-b-2 transition cursor-pointer ${
                navTab === "status" ? "border-[#00FF9C] text-[#00FF9C]" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t("status_tab")} ({statuses.length})
            </button>
            <button
              onClick={() => setNavTab("calls")}
              className={`flex-1 py-3.5 border-b-2 transition cursor-pointer ${
                navTab === "calls" ? "border-[#00FF9C] text-[#00FF9C]" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t("calls_tab")}
            </button>
          </div>

          {/* Content Lists */}
          <main className="flex-1 overflow-y-auto py-3 bg-[#050505]">
            
            {/* Tab 1: CHATS VIEW PANEL WITH SEAMLESS PRIVATE/GROUP SWITCH AND GROUPS CREATOR */}
            {navTab === "chats" && (
              <div id="chats-tab-view" className="px-3 space-y-3">
                {/* Seamless WhatsApp-style toggle to swap between private and group chat views */}
                <div className="flex gap-1 bg-[#0A0A0A] p-1 rounded-xl border border-white/5">
                  <button
                    id="tab-private-chats"
                    onClick={() => {
                      setChatTab("private");
                      setActiveChatType("private");
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      chatTab === "private"
                        ? "bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20"
                        : "text-gray-400 hover:text-white border border-transparent"
                    }`}
                  >
                    <span>💬</span> {t("private_tab") || "Direct Chats"}
                  </button>
                  <button
                    id="tab-group-chats"
                    onClick={() => {
                      setChatTab("group");
                      setActiveChatType("group");
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      chatTab === "group"
                        ? "bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/20"
                        : "text-gray-400 hover:text-white border border-transparent"
                    }`}
                  >
                    <span>👥</span> {t("groups_tab") || "Group Rooms"} ({groups.length})
                  </button>
                </div>

                {/* Group Creation UI Trigger Bar (Only shown under Group Section) */}
                {chatTab === "group" && (
                  <button
                    id="trigger-create-group-modal"
                    onClick={() => {
                      setNewGroupName("");
                      setSelectedGroupMembers([]);
                      setShowCreateGroupModal(true);
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-[#00D1FF]/10 to-[#00D1FF]/20 border border-[#00D1FF]/40 rounded-xl font-mono text-[10px] font-bold text-[#00D1FF] hover:from-[#00D1FF]/20 hover:to-[#00D1FF]/30 tracking-widest uppercase transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_2px_10px_rgba(0,209,255,0.05)]"
                  >
                    <Plus className="w-4 h-4 text-[#00D1FF]" />
                    <span>CREATE SECURE GROUP CHANNEL</span>
                  </button>
                )}

                {/* RENDERING PRIVATE ON-TO-ONE CHATS */}
                {chatTab === "private" && (
                  <div className="space-y-2">
                    {chats.length === 0 ? (
                      <div className="text-center py-20 text-gray-500 font-mono text-[11px] max-w-xs mx-auto space-y-4">
                        <div className="w-12 h-12 rounded-full border border-white/5 bg-[#0A0A0A] flex items-center justify-center mx-auto text-lg animate-bounce">
                          ✨
                        </div>
                        <p>No secure chats active. Launch code connection now!</p>
                        <button
                          onClick={() => setShowContacts(true)}
                          className="px-3 py-1.5 border border-[#00FF9C]/40 hover:border-[#00FF9C] rounded font-mono text-xxs text-[#00FF9C] bg-[#00FF9C]/5 transition cursor-pointer uppercase tracking-widest"
                        >
                          INITIALIZE NEW PAYLOAD
                        </button>
                      </div>
                    ) : (
                      (() => {
                        const filtered = [...chats].filter((room) => {
                          const otherUid = room.participants.find(p => p !== userId);
                          const isBot = otherUid === "ai-bot";
                          const profileObj = isBot 
                            ? STARTER_USERS["ai-bot"] 
                            : allUsers.find(u => u.uid === otherUid);
                          
                          if (!searchText) return true;
                          const nameMatch = profileObj?.displayName?.toLowerCase().includes(searchText.toLowerCase());
                          const lastMsgMatch = room.lastMessage?.toLowerCase().includes(searchText.toLowerCase());
                          return !!(nameMatch || lastMsgMatch);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-20 text-gray-500 font-mono text-[11px] max-w-xs mx-auto space-y-2">
                              <div>🔍</div>
                              <p className="font-bold text-[#00FF9C]">No Chats Found</p>
                              <p className="text-gray-400 text-[10px]">No matches for "{searchText}" in direct conversations.</p>
                            </div>
                          );
                        }

                        return filtered.sort((a, b) => {
                          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                          return timeB - timeA;
                        }).map((room) => {
                          const otherUid = room.participants.find(p => p !== userId);
                          const isBot = otherUid === "ai-bot";
                          
                          const profileObj = isBot 
                            ? STARTER_USERS["ai-bot"] 
                            : allUsers.find(u => u.uid === otherUid) || {
                                uid: otherUid || "fallback-id",
                                displayName: "Secure Client Node",
                                photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
                                bio: "Encrypted node",
                                phone: "+91 00000 00000",
                                isOnline: false
                              };

                          const roomMsgs = messages[room.id] || [];
                          const unreadCount = roomMsgs.filter(m => m.senderId !== userId && m.status !== "read").length;

                          return (
                            <div
                              id={`chat-room-item-${room.id}`}
                              key={room.id}
                              onClick={() => {
                                setActiveChatId(room.id);
                                setActiveChatType("private");
                              }}
                              className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                                activeChatId === room.id 
                                  ? "bg-[#101F1A]/80 border-[#00FF9C]/40 text-white" 
                                  : "bg-[#0A0A0A] border-white/5 hover:border-[#00FF9C]/20 hover:bg-[#0A0A0A]/60"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img src={profileObj.photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#050505]" />
                                  {profileObj.isOnline && (
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A] animate-pulse" />
                                  )}
                                </div>
                                <div className="max-w-[190px]">
                                  <h4 className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5 uppercase truncate">
                                    {profileObj.displayName}
                                    {isBot && (
                                      <span className="bg-[#00FF9C]/15 text-[#00FF9C] text-[8px] font-mono border border-[#00FF9C]/30 rounded px-1.5">AI</span>
                                    )}
                                  </h4>
                                  <p className="text-gray-400 text-[11px] font-sans truncate mt-0.5" title={room.lastMessage}>
                                    {room.lastMessageSender === userId ? "You: " : ""}{room.lastMessage}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="flex flex-col items-end gap-1 font-mono text-right">
                                  <span className="text-[9px] text-[#00D1FF]">{room.lastMessageTime ? formatMsgDate(room.lastMessageTime) : ""}</span>
                                  {unreadCount > 0 && (
                                    <span className="w-4 h-4 bg-[#00FF9C] text-black rounded-full text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(0,255,156,0.5)]">
                                      {unreadCount}
                                    </span>
                                  )}
                                </div>
                                <button
                                  id={`delete-chat-btn-${room.id}`}
                                  title="Delete secret chat history"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("Are you sure you want to delete this secret chat history? This action is irreversible.")) {
                                      try {
                                        await deleteChat(room.id);
                                        if (activeChatId === room.id) {
                                          setActiveChatId(null);
                                        }
                                      } catch (err) {
                                        console.error("Failed to delete chat:", err);
                                      }
                                    }
                                  }}
                                  className="w-7 h-7 rounded-lg bg-red-950/20 text-red-400 hover:text-red-300 border border-red-500/15 hover:bg-red-500/20 flex items-center justify-center transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                )}

                {/* RENDERING MANY-TO-MANY GROUPS */}
                {chatTab === "group" && (
                  <div className="space-y-2">
                    {groups.length === 0 ? (
                      <div className="text-center py-20 text-gray-500 font-mono text-[11px] max-w-sm mx-auto space-y-4">
                        <div className="w-11 h-11 rounded-full border border-gray-800 bg-[#0A0A0A] flex items-center justify-center mx-auto text-lg">
                          👥
                        </div>
                        <p className="tracking-wide text-gray-400">No group conversations are active.</p>
                        <p className="text-gray-600 text-[10px] leading-relaxed max-w-xs mx-auto">
                          Create an end-to-end secure group to communicate, broadcast updates, and share secure payloads with multiple members synchronously!
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = [...groups].filter((g) => {
                          if (!searchText) return true;
                          const nameMatch = g.name.toLowerCase().includes(searchText.toLowerCase());
                          const lastMsgMatch = g.lastMessage?.toLowerCase().includes(searchText.toLowerCase());
                          return nameMatch || lastMsgMatch;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-20 text-gray-500 font-mono text-[11px] max-w-xs mx-auto space-y-2">
                              <div>🔍</div>
                              <p className="font-bold text-[#00D1FF]">No Groups Found</p>
                              <p className="text-gray-400 text-[10px]">No matches for "{searchText}" in your group rooms.</p>
                            </div>
                          );
                        }

                        return filtered.sort((a, b) => {
                          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                          return timeB - timeA;
                        }).map((group) => {
                          const groupMsgs = messages[group.id] || [];
                          const unreadCount = groupMsgs.filter(m => m.senderId !== userId && m.status !== "read").length;
                          
                          return (
                            <div
                              id={`group-room-item-${group.id}`}
                              key={group.id}
                              onClick={() => {
                                setActiveChatId(group.id);
                                setActiveChatType("group");
                              }}
                              className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                                activeChatId === group.id 
                                  ? "bg-[#00D1FF]/5 border-[#00D1FF]/40 text-white" 
                                  : "bg-[#0A0A0A] border-white/5 hover:border-[#00D1FF]/20 hover:bg-[#0A0A0A]/60"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img src={group.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#050505]" />
                                  <span className="absolute -bottom-1 -right-1 bg-[#00D1FF]/25 border border-[#00D1FF]/50 text-[#00D1FF] text-[8px] font-mono rounded px-1 scale-90">GP</span>
                                </div>
                                <div className="max-w-[190px]">
                                  <h4 className="text-xs font-semibold text-white tracking-wide uppercase truncate">
                                    {group.name}
                                  </h4>
                                  <p className="text-gray-400 text-[11px] font-sans truncate mt-0.5" title={group.lastMessage}>
                                    {group.lastMessageSender === userId ? "You: " : ""}{group.lastMessage}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="flex flex-col items-end gap-1 font-mono text-right">
                                  <span className="text-[9px] text-[#00D1FF]">{group.lastMessageTime ? formatMsgDate(group.lastMessageTime) : ""}</span>
                                  {unreadCount > 0 && (
                                    <span className="w-4 h-4 bg-[#00D1FF] text-black rounded-full text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(0,209,255,0.5)]">
                                      {unreadCount}
                                    </span>
                                  )}
                                </div>
                                <button
                                  id={`delete-group-btn-${group.id}`}
                                  title="Dissolve secure group channel"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("Are you sure you want to dissolve/exit this secure group room? All local logs will be cleared.")) {
                                      try {
                                        await deleteGroup(group.id);
                                        if (activeChatId === group.id) {
                                          setActiveChatId(null);
                                        }
                                      } catch (err) {
                                        console.error("Failed to delete group:", err);
                                      }
                                    }
                                  }}
                                  className="w-7 h-7 rounded-lg bg-red-950/20 text-red-400 hover:text-red-300 border border-red-500/15 hover:bg-red-500/20 flex items-center justify-center transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                )}

                {/* CREATE GROUP MODAL DIALOG */}
                {showCreateGroupModal && (
                  <div id="create-group-dialog" className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-[#0E0E0E] border-2 border-[#00D1FF]/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(0,209,255,0.2)] flex flex-col max-h-[90vh]">
                      <div className="text-center space-y-2 mb-4">
                        <h3 className="text-white text-sm font-bold tracking-wider uppercase font-mono text-[#00D1FF]">
                          Create Secure Group
                        </h3>
                        <p className="text-gray-500 text-[11px]">
                          Select contacts to initialize a secure group session.
                        </p>
                      </div>

                      {/* Group Name input */}
                      <div className="space-y-1 mb-4">
                        <label className="text-xxs font-mono text-gray-400 uppercase tracking-wider block">Group Name</label>
                        <input
                          id="new-group-name-input"
                          type="text"
                          value={newGroupName}
                          onChange={e => setNewGroupName(e.target.value)}
                          placeholder="e.g. Flutter Devs, Syed's Design"
                          className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-700 font-sans focus:outline-none focus:border-[#00D1FF]"
                        />
                      </div>

                      {/* Contacts selector listing */}
                      <div className="flex-1 overflow-y-auto space-y-1.5 mb-4 max-h-[35vh] pr-1 scrollbar-thin">
                        <span className="text-xxs font-mono text-gray-400 uppercase tracking-wider block mb-1">Select Members</span>
                        {allUsers.filter(u => u.uid !== userId && u.uid !== "ai-bot").map(userObj => {
                          const isChecked = selectedGroupMembers.includes(userObj.uid);
                          return (
                            <div
                              id={`group-member-select-${userObj.uid}`}
                              key={userObj.uid}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedGroupMembers(prev => prev.filter(uid => uid !== userObj.uid));
                                } else {
                                  setSelectedGroupMembers(prev => [...prev, userObj.uid]);
                                }
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                                isChecked 
                                  ? "bg-[#00D1FF]/5 border-[#00D1FF]/40 text-white" 
                                  : "bg-[#0A0A0A] border-white/5 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <img src={userObj.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white/5" />
                                <div>
                                  <h5 className="text-[11px] font-semibold text-white">{userObj.displayName}</h5>
                                  <span className="text-[9px] text-gray-500 font-mono">{userObj.phone}</span>
                                </div>
                              </div>

                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                                isChecked ? "bg-[#00D1FF] border-[#00D1FF] text-black" : "border-gray-700 bg-transparent"
                              }`}>
                                {isChecked && <Check className="w-3 h-3 text-black stroke-[3px]" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Trigger Actions */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <button
                          id="submit-create-group-btn"
                          onClick={async () => {
                            if (!newGroupName.trim()) {
                              alert("Please enter a name for the group channel.");
                              return;
                            }
                            if (selectedGroupMembers.length === 0) {
                              alert("Please select at least one contact to include.");
                              return;
                            }
                            const finalMembers = [userId || "", ...selectedGroupMembers];
                            const createdId = await createGroup(newGroupName, finalMembers, userId || "");
                            
                            setActiveChatId(createdId);
                            setActiveChatType("group");
                            setShowCreateGroupModal(false);
                            setNewGroupName("");
                            setSelectedGroupMembers([]);
                          }}
                          className="w-full py-2.5 bg-[#00D1FF] text-black hover:bg-[#00D1FF]/80 font-mono text-xs font-bold tracking-widest uppercase rounded-xl transition cursor-pointer"
                        >
                          INITIALIZE GROUP
                        </button>
                        <button
                          onClick={() => setShowCreateGroupModal(false)}
                          className="w-full py-2 bg-transparent hover:bg-white/5 border border-white/10 text-gray-500 hover:text-white font-mono text-[9px] tracking-wider uppercase rounded-xl transition cursor-pointer"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: METADATA STATUS STORIES FEED */}
            {navTab === "status" && (
              <StatusFeed
                statuses={statuses}
                currentUserId={userId || ""}
                currentUserName={userProfile?.displayName || "User"}
                currentUserAvatar={userProfile?.photoURL || AVATAR_PRESETS[0]}
                onDeleteStatus={async (id) => {
                  try {
                    await deleteStatusStory(id);
                  } catch (e) {
                    console.error("Failed to delete status:", e);
                  }
                }}
              />
            )}

            {/* Tab 3: PHONE VOICE & VIDEO CALL HISTORY LOGGER */}
            {navTab === "calls" && (
              <div id="calls-tab-view" className="px-3 space-y-2">
                <div className="flex items-center justify-between border-b border-[#00FF9C]/10 pb-1 font-mono text-[9px] tracking-widest text-[#00FF9C] uppercase">
                  <span>TRANSMISSION WORK LOGS</span>
                </div>

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
                        className="bg-[#0A0A0A] p-3 rounded-2xl border border-white/5 hover:border-[#00FF9C]/10 transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border border-white/5 bg-gray-950/40 flex items-center justify-center">
                            <PhoneCall className={`w-4 h-4 ${isMissed ? "text-red-500 animate-pulse" : "text-[#00FF9C]"}`} />
                          </div>
                          <div>
                            <h4 className="text-white text-xs font-semibold">
                              {isOther ? log.callerName : log.receiverName}
                            </h4>
                            <p className="text-gray-400 text-xxs font-mono uppercase mt-0.5 flex items-center gap-1">
                              <span className={isMissed ? "text-red-500" : "text-lime-500"}>
                                {isMissed ? "MISSED" : "COMPLETED"}
                              </span>
                              {log.duration ? `• ${Math.floor(log.duration / 60)}m ${log.duration % 60}s` : ""}
                            </p>
                          </div>
                        </div>

                        <span className="text-[9px] text-gray-500 font-mono shrink-0">{formatMsgDate(log.timestamp)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

          </main>

          {/* Floating Action Button for Contact Selector triggers */}
          {navTab === "chats" && (
            <button
              id="fab-contacts-trigger"
              onClick={() => setShowContacts(true)}
              className="absolute bottom-6 right-6 md:right-auto md:left-[300px] z-20 w-14 h-14 bg-[#00FF9C] hover:bg-[#00D1FF] rounded-2xl shadow-[0_4px_15px_rgba(0,255,156,0.35)] flex items-center justify-center text-black hover:scale-105 cursor-pointer transition transform duration-200"
              title={t("search_contacts")}
            >
              <Plus className="w-6 h-6 text-black font-bold" />
            </button>
          )}

        </div>

        {/* MESSAGING PANE: Right area. Side by side panel on desktop, overlay fullscreen on mobile */}
        <div className={`flex-1 h-full flex flex-col bg-[#050505] transition-all ${
          activeChatId ? "flex" : "hidden md:flex items-center justify-center border-l border-white/5"
        }`}>
          
          {activeChatId && buddyProfile ? (
            <ChatWindow
              chatId={activeChatId}
              senderProfile={userProfile}
              receiverProfile={buddyProfile}
              messages={messages[activeChatId] || []}
              onBack={() => setActiveChatId(null)}
              onInitiateCall={handleStartCall}
              onUpdateProfile={setUserProfile}
              allUsers={allUsers}
              activeGroupDoc={groups.find(g => g.id === activeChatId)}
            />
          ) : (
            <div className="p-8 text-center max-w-sm space-y-5 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border border-white/5 bg-[#0C0C0C] flex items-center justify-center text-gray-650 shadow-md">
                <Lock className="w-6 h-6 text-gray-500" />
              </div>
              <div className="space-y-1 text-center">
                <h3 className="text-white text-xs font-bold font-mono uppercase tracking-widest">MAHRAJ MESSENGER SECURE EDGE</h3>
                <p className="text-gray-550 text-[11px] leading-relaxed font-sans">{t("no_chat_selected")}</p>
              </div>
              <div className="text-[9px] font-mono text-gray-600 bg-black-950 p-2 border border-white/5 rounded-lg flex items-center gap-1.5 uppercase tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00FF9C]" />
                End-to-End Cryptography Enabled
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Contacts selectors */}
      {showContacts && (
        <ContactSelector
          contacts={allUsers}
          currentUserId={userId || ""}
          onSelectContact={handleStartChatWithContact}
          onClose={() => setShowContacts(false)}
          activeChatPartnerIds={chats.map(c => c.participants.find(p => p !== userId)).filter(Boolean) as string[]}
        />
      )}
    </div>
  );
}
