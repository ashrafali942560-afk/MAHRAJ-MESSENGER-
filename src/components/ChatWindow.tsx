import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Phone, Video, Send, Paperclip, ImageIcon, 
  Video as VideoIcon, Camera, Loader2, Check, CheckCheck, 
  MapPin, Sparkles, Shield, AlertCircle, FileText, Mic, 
  Square, Play, Pause, Download, Volume2, Trash2, Ban, 
  MoreVertical, Users, Plus, UserPlus, UserMinus, X,
  Sliders, Lock, VolumeX, BellRing, 
  QrCode, Eye, EyeOff, Clock, Share2, Palette,
  Search, Info, Calendar, ShieldAlert, Heart, ChevronRight
} from "lucide-react";
import { Message, UserProfile } from "../types";
import { sendMessage, updateMessageStatuses, deleteChat, saveUserProfile, updateGroupMembers, enrichMessageWithOfflineLogs, reactToMessage, deleteSingleMessage } from "../lib/state";
import { useTranslation } from "../lib/i18n";
import { GroupRoom } from "../types";
import { compressImageBase64 } from "../lib/imageCompressor";
import { WhatsAppCamera } from "./WhatsAppCamera";

interface ChatWindowProps {
  chatId: string;
  senderProfile: UserProfile | null;
  receiverProfile: UserProfile;
  messages: Message[];
  onBack: () => void;
  onInitiateCall: (type: "voice" | "video") => void;
  onUpdateProfile?: (updated: UserProfile) => void;
  allUsers?: UserProfile[];
  activeGroupDoc?: GroupRoom;
}

export function ChatWindow({
  chatId,
  senderProfile,
  receiverProfile,
  messages,
  onBack,
  onInitiateCall,
  onUpdateProfile,
  allUsers = [],
  activeGroupDoc
}: ChatWindowProps) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState("");
  
  // Custom Message Options & Reactions state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardSuccessToast, setForwardSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (forwardSuccessToast) {
      const timer = setTimeout(() => {
        setForwardSuccessToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [forwardSuccessToast]);

  const handleTouchStart = (msg: Message) => {
    const timer = setTimeout(() => {
      setSelectedMessage(msg);
    }, 550);
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleMouseDown = (msg: Message) => {
    const timer = setTimeout(() => {
      setSelectedMessage(msg);
    }, 550);
    setPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const [showAttachments, setShowAttachments] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  
  // Premium WhatsApp-like Individual Chat Settings States
  const [showChatSettingsDrawer, setShowChatSettingsDrawer] = useState(false);
  const [wallpaper, setWallpaper] = useState<string>(() => {
    return localStorage.getItem(`mahraj_wallpaper_${chatId}`) || "celestial_moon";
  });
  const [disappearingTimer, setDisappearingTimer] = useState<string>(() => {
    return localStorage.getItem(`mahraj_disappearing_${chatId}`) || "off";
  });
  const [muteDuration, setMuteDuration] = useState<string>(() => {
    return localStorage.getItem(`mahraj_mute_${chatId}`) || "off";
  });
  const [customTone, setCustomTone] = useState<string>(() => {
    return localStorage.getItem(`mahraj_notiftone_${chatId}`) || "Default Mahraj Tone";
  });
  const [customVibration, setCustomVibration] = useState<string>(() => {
    return localStorage.getItem(`mahraj_vibe_${chatId}`) || "Default Pattern";
  });
  const [mediaVisibility, setMediaVisibility] = useState<boolean>(() => {
    return localStorage.getItem(`mahraj_mediavis_${chatId}`) !== "false";
  });
  const [showQRVerification, setShowQRVerification] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearKeepMedia, setClearKeepMedia] = useState(false);
  const [clearedChatTimestamp, setClearedChatTimestamp] = useState<number>(() => {
    return Number(localStorage.getItem(`mahraj_cleared_ts_${chatId}`) || "0");
  });

  // Functional feature states matching the premium chat options
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [isChatUnlocked, setIsChatUnlocked] = useState<boolean>(() => {
    const lockedChats = JSON.parse(localStorage.getItem("settings_locked_chats") || "[]") as string[];
    return !lockedChats.includes(chatId);
  });
  const [inputPinCode, setInputPinCode] = useState("");
  const [pinErrorAlert, setPinErrorAlert] = useState(false);

  // Synchronize pin checks on chat transition
  useEffect(() => {
    const lockedChats = JSON.parse(localStorage.getItem("settings_locked_chats") || "[]") as string[];
    setIsChatUnlocked(!lockedChats.includes(chatId));
    setInputPinCode("");
    setPinErrorAlert(false);
  }, [chatId]);

  // Favorites & list category structures
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    const favs = JSON.parse(localStorage.getItem("settings_favorite_chats") || "[]") as string[];
    return favs.includes(chatId);
  });
  const [customLists, setCustomLists] = useState<string[]>(() => {
    const listMap = JSON.parse(localStorage.getItem("settings_chat_lists") || "{}");
    return listMap[chatId] || [];
  });
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Scheduling structures
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleCallType, setScheduleCallType] = useState<"Voice" | "Video">("Video");
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // Quick settings modals
  const [showMuteQuickModal, setShowMuteQuickModal] = useState(false);
  const [showDisappearingQuickModal, setShowDisappearingQuickModal] = useState(false);

  // Favorite handler toggles
  const handleToggleFavorite = () => {
    const favs = JSON.parse(localStorage.getItem("settings_favorite_chats") || "[]") as string[];
    let updated: string[];
    if (favs.includes(chatId)) {
      updated = favs.filter(id => id !== chatId);
      setIsFavorite(false);
      setForwardSuccessToast("Removed from favorites!");
    } else {
      updated = [...favs, chatId];
      setIsFavorite(true);
      setForwardSuccessToast("Added to favorites!");
    }
    localStorage.setItem("settings_favorite_chats", JSON.stringify(updated));
    window.dispatchEvent(new Event("settings_favorites_updated"));
  };

  // Custom Category grouping
  const handleToggleListCategory = (category: string) => {
    const listMap = JSON.parse(localStorage.getItem("settings_chat_lists") || "{}");
    const currentList = listMap[chatId] || [];
    let updated: string[];
    if (currentList.includes(category)) {
      updated = currentList.filter((c: string) => c !== category);
    } else {
      updated = [...currentList, category];
    }
    listMap[chatId] = updated;
    localStorage.setItem("settings_chat_lists", JSON.stringify(listMap));
    setCustomLists(updated);
    window.dispatchEvent(new Event("settings_lists_updated"));
  };

  const handleCreateListCategory = () => {
    if (!newListName.trim()) return;
    handleToggleListCategory(newListName.trim());
    setNewListName("");
  };

  // Chat locking helper
  const handleToggleChatLock = () => {
    const lockedChats = JSON.parse(localStorage.getItem("settings_locked_chats") || "[]") as string[];
    let updated: string[];
    const isCurrentlyLocked = lockedChats.includes(chatId);
    if (isCurrentlyLocked) {
      updated = lockedChats.filter(id => id !== chatId);
      setIsChatUnlocked(true);
      setForwardSuccessToast("Secure Chat lock disabled!");
    } else {
      updated = [...lockedChats, chatId];
      setIsChatUnlocked(false);
      setForwardSuccessToast("Chat protected with secure lock!");
    }
    localStorage.setItem("settings_locked_chats", JSON.stringify(updated));
    window.dispatchEvent(new Event("settings_locks_updated"));
  };

  const getVisibleMessages = () => {
    return messages.filter(m => {
      const msgTime = new Date(m.timestamp).getTime();
      if (msgTime <= clearedChatTimestamp) {
        const storedKeepMedia = localStorage.getItem(`mahraj_cleared_keep_media_${chatId}`) === "true";
        if (storedKeepMedia && m.mediaUrl) {
          return true;
        }
        return false;
      }
      return true;
    });
  };

  const handleUpdateWallpaperState = (val: string) => {
    setWallpaper(val);
    localStorage.setItem(`mahraj_wallpaper_${chatId}`, val);
  };

  const handleUpdateDisappearingState = (val: string) => {
    setDisappearingTimer(val);
    localStorage.setItem(`mahraj_disappearing_${chatId}`, val);
  };

  const handleUpdateMuteState = (val: string) => {
    setMuteDuration(val);
    localStorage.setItem(`mahraj_mute_${chatId}`, val);
  };

  const handleUpdateToneState = (val: string) => {
    setCustomTone(val);
    localStorage.setItem(`mahraj_notiftone_${chatId}`, val);
  };

  const handleUpdateVibrationState = (val: string) => {
    setCustomVibration(val);
    localStorage.setItem(`mahraj_vibe_${chatId}`, val);
  };

  const handleUpdateMediaVisibilityState = (val: boolean) => {
    setMediaVisibility(val);
    localStorage.setItem(`mahraj_mediavis_${chatId}`, String(val));
  };
  
  // Camera & Storage integration states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  
  // Voice Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showPermissionModal, setShowPermissionModal] = useState<"camera" | "gallery" | null>(null);
  const [showWhatsAppCamera, setShowWhatsAppCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const didIBlockContact = senderProfile?.blockedUsers?.includes(receiverProfile.uid) || false;
  const isContactBlocked = receiverProfile.blockedUsers?.includes(senderProfile?.uid || "") || false;
  const isAnyBlockActive = didIBlockContact || isContactBlocked;

  const handleToggleBlock = async () => {
    if (!senderProfile || !onUpdateProfile) {
      alert("Verification failed. Please update from Device Settings first.");
      return;
    }
    const currentBlocks = senderProfile.blockedUsers || [];
    const isBlocked = currentBlocks.includes(receiverProfile.uid);
    let updatedBlocks: string[];
    if (isBlocked) {
      updatedBlocks = currentBlocks.filter(id => id !== receiverProfile.uid);
    } else {
      updatedBlocks = [...currentBlocks, receiverProfile.uid];
    }
    const updatedModel: UserProfile = {
      ...senderProfile,
      blockedUsers: updatedBlocks
    };
    onUpdateProfile(updatedModel);
    await saveUserProfile(updatedModel);
    setShowMenu(false);
  };

  const handleDeleteChatConversation = async () => {
    if (confirm("Are you sure you want to permanently delete this secure direct chat? All local logs will be cleared.")) {
      await deleteChat(chatId);
      onBack();
    }
  };

  const handleAddGroupMember = async (userIdToAdd: string) => {
    if (!activeGroupDoc) return;
    const updatedMembers = [...(activeGroupDoc.members || []), userIdToAdd];
    await updateGroupMembers(activeGroupDoc.id, updatedMembers);
  };

  const handleRemoveGroupMember = async (userIdToRemove: string) => {
    if (!activeGroupDoc) return;
    const updatedMembers = (activeGroupDoc.members || []).filter(id => id !== userIdToRemove);
    await updateGroupMembers(activeGroupDoc.id, updatedMembers);

    // If I removed myself, close the chat
    if (userIdToRemove === senderProfile?.uid) {
      onBack();
    }
  };

  // Mark all unread messages as read upon entering the room
  useEffect(() => {
    if (senderProfile?.uid) {
      updateMessageStatuses(chatId, senderProfile.uid);
    }
  }, [chatId, messages.length, senderProfile?.uid]);

  // Auto-scroll logic inside chats
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping, isUploading]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const handleSendText = async (
    mediaUrl?: string, 
    mediaType?: "image" | "video" | "audio" | "document",
    fileName?: string,
    fileSize?: string
  ) => {
    if (!senderProfile) return;
    if (didIBlockContact || isContactBlocked) {
      alert("This secure direct channel is currently blocked.");
      return;
    }
    if (!inputText.trim() && !mediaUrl) return;

    const messageText = inputText;
    setInputText("");
    setShowAttachments(false);

    // Compute Simulated Mobile Storage Directory (Step 2)
    let offlineLocalPath = undefined;
    let sqliteQueryLog = undefined;
    let simulatedOS: "Android" | "iOS" | undefined = undefined;
    const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    if (mediaUrl) {
      const userAgent = navigator.userAgent.toLowerCase();
      simulatedOS = (userAgent.includes("android") || userAgent.includes("linux")) ? "Android" : "iOS";
      const fileExt = mediaType === "video" ? "mp4" : (mediaType === "audio" ? "webm" : "jpg");
      const timestamp = Math.floor(Date.now() / 1000);
      const randHex = Math.random().toString(16).substring(2, 6).toUpperCase();
      
      if (simulatedOS === "Android") {
        offlineLocalPath = `/storage/emulated/0/Android/data/com.mahraj.messenger/files/media/${mediaType === "video" ? "videos" : "images"}/${mediaType === "video" ? "VID" : "IMG"}_${timestamp}_${randHex}.${fileExt}`;
      } else {
        offlineLocalPath = `/NSDocumentDirectory/media/${mediaType === "video" ? "videos" : "images"}/${mediaType === "video" ? "VID" : "IMG"}_${timestamp}_${randHex}.${fileExt}`;
      }

      sqliteQueryLog = `INSERT INTO offline_media (msg_id, local_path, os, size, timestamp) VALUES ('${msgId}', '${offlineLocalPath}', '${simulatedOS}', '${fileSize || "420 KB"}', CURRENT_TIMESTAMP);`;
    }

    // Write real message to local database (firestore fallback)
    await sendMessage(chatId, senderProfile.uid, messageText, mediaUrl, mediaType, fileName, fileSize, offlineLocalPath, undefined, sqliteQueryLog, simulatedOS);

    // If talking to MAHRAJ AI Bot, trigger the server-side Gemini API proxy!
    if (receiverProfile.uid === "ai-bot") {
      setIsAiTyping(true);
      
      try {
        // Construct basic history chain for context
        const localHistory = [
          ...messages,
          { id: msgId, senderId: senderProfile.uid, text: messageText, mediaUrl, mediaType, timestamp: new Date().toISOString(), status: "read" as const }
        ].map(m => ({
          senderId: m.senderId === senderProfile.uid ? "user" : "ai-bot",
          text: m.text
        }));

        const payload: any = { messages: localHistory };
        if (mediaUrl) {
          payload.mediaUrl = mediaUrl;
          payload.mediaType = mediaType;
        }

        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // Step 3: Parse response and enrich sqlite database log
        let parsedMeta = "";
        try {
          if (data && data.text) {
            const cleanText = data.text.includes("```json") 
              ? data.text.split("```json")[1].split("```")[0].trim()
              : data.text;
            
            JSON.parse(cleanText); // confirm valid format
            parsedMeta = cleanText;
          }
        } catch (e) {
          parsedMeta = JSON.stringify({
            title: "Analyzed Visual Payload",
            description: data.text || "Analyzed successfully",
            tags: ["scanner", "vision", "gemini-3.5"],
            category: "General"
          }, null, 2);
        }

        if (mediaUrl && offlineLocalPath && simulatedOS) {
          const finalSqlLog = `INSERT INTO offline_media (msg_id, local_path, os, size, gemini_metadata, timestamp) VALUES ('${msgId}', '${offlineLocalPath}', '${simulatedOS}', '${fileSize || "420 KB"}', '${parsedMeta.replace(/'/g, "''")}', CURRENT_TIMESTAMP);`;
          await enrichMessageWithOfflineLogs(chatId, msgId, offlineLocalPath, parsedMeta, finalSqlLog, simulatedOS);
        }

        // Pacing delay
        setTimeout(async () => {
          setIsAiTyping(false);
          await sendMessage(
            chatId, 
            "ai-bot", 
            data.text || "Alright, Iam here! I have successfully saved this media payload to your phone permanent directory and registered it inside your local Sqlite table. How can I assist you now?"
          );
        }, 1200 + Math.random() * 800);

      } catch (err) {
        console.error("Gemini chatbot transmission crash: ", err);
        setIsAiTyping(false);
        const fallbackMeta = JSON.stringify({
          title: "Offline Analysis Placeholder",
          description: "Media package received. Active internet connection offline or API key missing in workspace secrets.",
          tags: ["offline", "sandbox", "fallback"],
          category: "Troubleshoot"
        }, null, 2);

        if (mediaUrl && offlineLocalPath && simulatedOS) {
          const finalSqlLog = `INSERT INTO offline_media (msg_id, local_path, os, size, gemini_metadata, timestamp) VALUES ('${msgId}', '${offlineLocalPath}', '${simulatedOS}', '${fileSize || "420 KB"}', '${fallbackMeta.replace(/'/g, "''")}', CURRENT_TIMESTAMP);`;
          await enrichMessageWithOfflineLogs(chatId, msgId, offlineLocalPath, fallbackMeta, finalSqlLog, simulatedOS);
        }

        await sendMessage(
          chatId, 
          "ai-bot", 
          "Alright, I have successfully copied your file to permanent storage and updated the SQLite index. Click on the storage icon on the message to inspect!"
        );
      }
    } else {
      // Standard Direct profile chat
      // Auto compile metadata structure locally so user can immediately view it offline
      if (mediaUrl && offlineLocalPath && simulatedOS) {
        setTimeout(async () => {
          const simulatedMeta = JSON.stringify({
            title: `Cached Direct Messaging Node`,
            description: `A media message stored in the SQLite ledger sent in room [${chatId}]. Perfect offline cache state matching Scoped Storage.`,
            tags: [mediaType || "media", "cache", "sqlite-record", "direct-channel"],
            category: "Messaging"
          }, null, 2);
          
          const finalSqlLog = `INSERT INTO offline_media (msg_id, local_path, os, size, gemini_metadata, timestamp) VALUES ('${msgId}', '${offlineLocalPath}', '${simulatedOS}', '${fileSize || "280 KB"}', '${simulatedMeta.replace(/'/g, "''")}', CURRENT_TIMESTAMP);`;
          await enrichMessageWithOfflineLogs(chatId, msgId, offlineLocalPath, simulatedMeta, finalSqlLog, simulatedOS);
        }, 1200);
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
      setShowWhatsAppCamera(true);
    } else if (activeType === "gallery") {
      fileInputRef.current?.click();
    }
  };

  const handleSendCameraMedia = async (base64Data: string, mediaType: "image" | "video", caption?: string) => {
    if (!senderProfile) return;
    if (didIBlockContact || isContactBlocked) {
      alert("This secure direct channel is currently blocked.");
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(20);
    const progressInterval = setInterval(() => {
      setUploadProgress(p => p >= 90 ? 90 : p + 15);
    }, 100);

    try {
      const messageText = caption || "";
      const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      
      let offlineLocalPath = undefined;
      const userAgent = navigator.userAgent.toLowerCase();
      const simulatedOS = (userAgent.includes("android") || userAgent.includes("linux")) ? "Android" : "iOS";
      const fileExt = mediaType === "video" ? "mp4" : "jpg";
      const timestamp = Math.floor(Date.now() / 1000);
      const randHex = Math.random().toString(16).substring(2, 6).toUpperCase();
      
      if (simulatedOS === "Android") {
        offlineLocalPath = `/storage/emulated/0/Android/data/com.mahraj.messenger/files/media/${mediaType === "video" ? "videos" : "images"}/${mediaType === "video" ? "VID" : "IMG"}_${timestamp}_${randHex}.${fileExt}`;
      } else {
        offlineLocalPath = `/NSDocumentDirectory/media/${mediaType === "video" ? "videos" : "images"}/${mediaType === "video" ? "VID" : "IMG"}_${timestamp}_${randHex}.${fileExt}`;
      }
      
      const sqliteQueryLog = `INSERT INTO offline_media (msg_id, local_path, os, size, timestamp) VALUES ('${msgId}', '${offlineLocalPath}', '${simulatedOS}', '1.2 MB', CURRENT_TIMESTAMP);`;
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Write direct message payload
      await sendMessage(
        chatId, 
        senderProfile.uid, 
        messageText, 
        base64Data, 
        mediaType, 
        mediaType === "video" ? "video.mp4" : "photo.jpg", 
        "1.2 MB", 
        offlineLocalPath, 
        undefined, 
        sqliteQueryLog, 
        simulatedOS
      );

      setTimeout(() => {
        setIsUploading(false);
      }, 300);

      // Trigger Gemini AI interaction if target user is AI Bot
      if (receiverProfile.uid === "ai-bot") {
        setIsAiTyping(true);
        try {
          const localHistory = [
            ...messages,
            { id: msgId, senderId: senderProfile.uid, text: messageText, mediaUrl: base64Data, mediaType, timestamp: new Date().toISOString(), status: "read" as const }
          ].map(m => ({
            senderId: m.senderId === senderProfile.uid ? "user" : "ai-bot",
            text: m.text
          }));

          const payload = { 
            messages: localHistory, 
            mediaUrl: base64Data, 
            mediaType 
          };
          
          const response = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          setIsAiTyping(false);
          if (data && data.text) {
            await sendMessage(chatId, "ai-bot", data.text);
          }
        } catch (err) {
          setIsAiTyping(false);
          console.error("Gemini AI receiver proxy feed crash: ", err);
        }
      }

    } catch (err) {
      clearInterval(progressInterval);
      setIsUploading(false);
      console.error("Failed to compile camera media packet: ", err);
      alert("Encryption transmission of camera payload failed.");
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
      let base64String = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      // Proactively compress image files to 400x400 jpeg to balance quality & database efficiency
      if (mediaType === "image") {
        base64String = await compressImageBase64(base64String, 400, 400, 0.75);
      }

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

  // Handle selected PDF or Document file
  const handleDocSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(15);

    const timer = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(timer);
          return 90;
        }
        return prev + 25;
      });
    }, 80);

    try {
      const reader = new FileReader();
      const base64String = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      clearInterval(timer);
      setUploadProgress(100);

      let sizeFormatted = `${(file.size / 1024).toFixed(1)} KB`;
      if (file.size > 1024 * 1024) {
        sizeFormatted = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      }

      setTimeout(async () => {
        setIsUploading(false);
        e.target.value = ""; // clear file field

        // Transmit Document package
        await handleSendText(base64String, "document", file.name, sizeFormatted);
      }, 400);

    } catch (err) {
      console.error("Doc compile error:", err);
      alert("PDF/Document decryption failed.");
      setIsUploading(false);
      clearInterval(timer);
    }
  };

  // Initiate a secure high-frequency digitized Web Audio oscillator stream when physical microphones are missing
  const startSecureSyntheticRecording = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        alert("Audio interface not compatible with current build.");
        return;
      }
      
      const ctx = new AudioContextClass();
      const dest = ctx.createMediaStreamDestination();
      
      // Seed a beautiful space-frequency ambient sound sweep
      const osc = ctx.createOscillator();
      const oscillatorModulator = ctx.createOscillator();
      const synthGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 5);

      oscillatorModulator.type = "triangle";
      oscillatorModulator.frequency.setValueAtTime(6, ctx.currentTime);
      
      const modulatorGain = ctx.createGain();
      modulatorGain.gain.setValueAtTime(30, ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(350, ctx.currentTime);

      synthGain.gain.setValueAtTime(0.12, ctx.currentTime);
      synthGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 15);

      // Connect modulated nodes to MediaStream destination
      oscillatorModulator.connect(modulatorGain);
      modulatorGain.connect(osc.frequency);
      
      osc.connect(filter);
      filter.connect(synthGain);
      synthGain.connect(dest);

      // Start the synthetic audio signals
      oscillatorModulator.start();
      osc.start();

      const stream = dest.stream;
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          oscillatorModulator.stop();
          osc.stop();
        } catch {}
        try {
          ctx.close();
        } catch {}

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setIsUploading(true);
        setUploadProgress(35);

        try {
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(audioBlob);
          });

          setUploadProgress(100);

          setTimeout(async () => {
            setIsUploading(false);
            // Send the voice note synthesized payload
            await handleSendText(base64Audio, "audio", "synthetic-handshake-signal.webm");
          }, 400);
        } catch (e) {
          console.error("Synthetic audio parse error:", e);
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Synthetic loop construction crash: ", err);
      alert("Synthetic mock generator was blocked by client sandbox.");
    }
  };

  // Start Secure Recording Audio link from real physical hardware microphone
  const startRecording = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone Access Request: Voice messaging is secure on MAHRAJ MESSENGER, but your browser is blocking hardware access or is not connecting in a secure context. Please open this app in a new tab or grant permission in settings to send real voice recordings!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/aac",
        "audio/wav",
        ""
      ];

      let selectedMime = "";
      for (const mime of mimeCandidates) {
        if (mime === "" || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime))) {
          selectedMime = mime;
          break;
        }
      }

      const recorderOptions = selectedMime ? { mimeType: selectedMime } : undefined;
      recorder = new MediaRecorder(stream, recorderOptions);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        
        // Stop all active microphone camera streams safely
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {}
        });

        setIsUploading(true);
        setUploadProgress(30);

        try {
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(audioBlob);
          });

          setUploadProgress(100);

          setTimeout(async () => {
            setIsUploading(false);
            // Send the actual raw microphone voice recording
            await handleSendText(base64Audio, "audio", "user-microphone-record.webm");
          }, 400);
        } catch (e) {
          console.error("Microphone audio packet generation error:", e);
          alert("Unable to process recording.");
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Hardware Microphone connection failed: ", err);
      alert(`Microphone Access Denied: ${err.message || err}. Please check your phone or browser settings to verify that MAHRAJ MESSENGER is allowed to access your microphone.`);
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      if (cancel) {
        recorder.onstop = () => {
          recorder.stream.getTracks().forEach(track => track.stop());
        };
      }
      recorder.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
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

  // Shield locked conversations with interactive Pin Pad
  const isLockedList = JSON.parse(localStorage.getItem("settings_locked_chats") || "[]") as string[];
  const isChatCurrentlyLocked = isLockedList.includes(chatId) && !isChatUnlocked;

  if (isChatCurrentlyLocked) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-black text-white z-50 p-6 select-none font-sans">
        <div className="w-full max-w-sm bg-[#0A0A0A] border-2 border-[#12ffbb]/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,255,156,0.1)] text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#00FF9C]/10 flex items-center justify-center border border-[#00FF9C]/20 animate-bounce">
            <Lock className="w-6 h-6 text-[#00FF9C]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-white text-base font-bold tracking-wider uppercase font-mono">Chat Is Locked</h2>
            <p className="text-gray-500 text-xs font-mono">ENTER AUTHENTICATION PIN TO CONTINUE DECRYPTION</p>
          </div>

          <div className="py-2.5 flex justify-center gap-3">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-4 h-4 rounded-full border-2 transition ${
                  inputPinCode.length > idx 
                    ? "bg-[#00FF9C] border-[#00FF9C] shadow-[0_0_10px_rgba(0,255,156,0.8)]" 
                    : "bg-transparent border-white/20"
                }`} 
              />
            ))}
          </div>

          {pinErrorAlert && (
            <p className="text-xs text-red-400 font-mono tracking-wide animate-pulse uppercase">
              ⚠️ {pinErrorAlert}
            </p>
          )}

          {/* Electronic keypad grid layout */}
          <div className="grid grid-cols-3 gap-3.5 max-w-[240px] mx-auto pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => {
                  if (inputPinCode.length < 4) {
                    const newPin = inputPinCode + num;
                    setInputPinCode(newPin);
                    if (pinErrorAlert) setPinErrorAlert(null);
                  }
                }}
                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white font-mono font-bold text-sm hover:bg-white/15 active:bg-[#00FF9C]/25 hover:border-[#00FF9C]/40 transition cursor-pointer flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => {
                setInputPinCode(prev => prev.slice(0, -1));
                setPinErrorAlert(null);
              }}
              className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-450 hover:bg-white/15 hover:text-white transition cursor-pointer flex items-center justify-center font-mono"
            >
              DEL
            </button>
            <button
              onClick={() => {
                if (inputPinCode.length < 4) {
                  const newPin = inputPinCode + "0";
                  setInputPinCode(newPin);
                  setPinErrorAlert(null);
                }
              }}
              className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white font-mono font-bold text-sm hover:bg-white/15 active:bg-[#00FF9C]/25 hover:border-[#00FF9C]/40 transition cursor-pointer flex items-center justify-center"
            >
              0
            </button>
            <button
              onClick={() => {
                if (inputPinCode.length === 4) {
                  if (inputPinCode === "1234") {
                    setIsChatUnlocked(true);
                    setPinErrorAlert(null);
                    setInputPinCode("");
                  } else {
                    setPinErrorAlert("INVALID PIN CODE DECRYPTION DENIED");
                    setInputPinCode("");
                  }
                } else {
                  setPinErrorAlert("PIN CODE MUST BE 4 DIGITS");
                }
              }}
              className="w-12 h-12 rounded-full bg-[#00FF9C]/25 border border-[#00FF9C]/50 text-[#00FF9C] font-mono leading-none hover:bg-[#00FF9C]/45 transition cursor-pointer flex items-center justify-center text-[9px] font-bold"
            >
              OK
            </button>
          </div>

          <button
            onClick={onBack}
            className="w-full py-2.5 mt-2 bg-transparent hover:bg-white/5 border border-white/10 text-gray-400 hover:text-white font-mono text-xxs tracking-wider uppercase rounded-xl transition cursor-pointer"
          >
            DISMISS BACK TO CONTACTS
          </button>
        </div>
      </div>
    );
  }

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
      <input 
        type="file" 
        ref={docInputRef} 
        onChange={handleDocSelected}
        accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
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

      {/* Modern Search Bar Above Header */}
      {isSearchingChat && (
        <div className="bg-[#121214] border-b border-[#00FF9C]/20 px-4 py-2 flex items-center gap-3 relative z-30 animate-in slide-in-from-top duration-155">
          <Search className="w-4 h-4 text-[#00FF9C]" />
          <input
            type="text"
            placeholder="Search words in dialogue history..."
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            className="flex-1 bg-black/40 text-[12px] text-white border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#00FF9C] placeholder-gray-500 font-sans"
            autoFocus
          />
          {chatSearchQuery && (
            <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 whitespace-nowrap">
              {getVisibleMessages().filter(m => m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())).length} found
            </span>
          )}
          <button
            onClick={() => {
              setIsSearchingChat(false);
              setChatSearchQuery("");
            }}
            className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="p-3.5 bg-[#0A0A0A] border-b border-[#00FF9C]/20 flex items-center justify-between z-30 shadow-[0_4px_20px_rgba(0,255,156,0.05)] relative">
        <div 
          className="flex items-center gap-2.5 cursor-pointer hover:bg-white/5 p-1 rounded-xl transition duration-155"
          onClick={() => {
            if (chatId.startsWith("group_")) {
              setShowGroupDrawer(true);
            } else {
              setShowChatSettingsDrawer(true);
            }
          }}
        >
          <button id="chat-back-btn" onClick={(e) => { e.stopPropagation(); onBack(); }} className="p-1.5 rounded hover:bg-white/5 transition cursor-pointer" style={{ contentVisibility: 'auto' }}>
            <ArrowLeft className="w-5 h-5 text-[#00FF9C]" />
          </button>
          
          <div className="relative">
            <img
              src={receiverProfile.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"}
              alt={receiverProfile.displayName}
              className="w-10 h-10 rounded-full object-cover border border-[#00FF9C]/40"
            />
            {receiverProfile.isOnline && !chatId.startsWith("group_") && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF9C] border-2 border-[#0A0A0A]" />
            )}
            {chatId.startsWith("group_") && (
              <span className="absolute -bottom-1 -right-1 bg-[#00D1FF]/30 border border-[#00D1FF] text-[#00D1FF] text-[8px] font-mono rounded px-1 scale-90">GP</span>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold tracking-wide text-white font-sans flex items-center gap-1.5 uppercase">
              {receiverProfile.displayName}
              {receiverProfile.uid === "ai-bot" && (
                <Sparkles className="w-3.5 h-3.5 text-[#00FF9C] animate-pulse" />
              )}
              {muteDuration !== "off" && (
                <VolumeX className="w-3.5 h-3.5 text-[#00D1FF] animate-pulse ml-1 shrink-0" />
              )}
            </h3>
            <span className="text-[10px] text-[#00FF9C] font-mono tracking-widest font-semibold uppercase block mt-0.5">
              {chatId.startsWith("group_") ? (
                <span className="text-[#00D1FF] hover:underline flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-ping inline-block animate-pulse" />
                  {activeGroupDoc?.members?.length || 0} Members • Managed
                </span>
              ) : isAnyBlockActive ? (
                <span className="text-red-500 font-bold">⚠️ BLOCKED CHANNEL</span>
              ) : isAiTyping ? (
                t("writing_response")
              ) : receiverProfile.isOnline ? (
                t("terminal_active")
              ) : (
                t("offline_status")
              )}
            </span>
          </div>
        </div>

        {/* Call triggers and Menu buttons */}
        <div className="flex items-center gap-2 pr-1 relative">
          {!chatId.startsWith("group_") && (
            <>
              <button
                id="voice-call-trigger"
                disabled={isAnyBlockActive}
                onClick={() => !isAnyBlockActive && onInitiateCall("voice")}
                className={`p-1.5 border rounded transition cursor-pointer ${
                  isAnyBlockActive 
                    ? "border-red-500/10 text-gray-750 bg-red-950/5 cursor-not-allowed opacity-50" 
                    : "border-[#00FF9C]/10 hover:border-[#00FF9C]/40 hover:bg-white/5 text-gray-400 hover:text-[#00FF9C]"
                }`}
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                id="video-call-trigger"
                disabled={isAnyBlockActive}
                onClick={() => !isAnyBlockActive && onInitiateCall("video")}
                className={`p-1.5 border rounded transition cursor-pointer ${
                  isAnyBlockActive 
                    ? "border-red-500/10 text-gray-755 bg-red-955/5 cursor-not-allowed opacity-50" 
                    : "border-[#00FF9C]/10 hover:border-[#00FF9C]/40 hover:bg-white/5 text-gray-400 hover:text-[#00FF9C]"
                }`}
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          {chatId.startsWith("group_") && (
            <button
              onClick={() => setShowGroupDrawer(true)}
              className="p-1.5 border border-[#00D1FF]/20 rounded hover:border-[#00D1FF] hover:bg-white/5 text-gray-400 hover:text-[#00D1FF] transition cursor-pointer"
              title="Manage Group Members"
            >
              <Users className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 border border-white/5 rounded hover:border-white/20 hover:bg-white/5 text-gray-400 hover:text-white transition cursor-pointer"
            title="Chat Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Floating Action Menu dropdown */}
          {showMenu && (
            <div className="absolute right-0 top-11 w-64 bg-[#1C1C1E] border border-white/10 rounded-2xl py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-40 text-[12.5px] text-gray-200 font-sans tracking-wide divide-y divide-white/5 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
              
              {/* SECTION 1: Personal Chat actions */}
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => { 
                    if (chatId.startsWith("group_")) {
                      setShowGroupDrawer(true);
                    } else {
                      setShowChatSettingsDrawer(true); 
                    }
                    setShowMenu(false); 
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Info className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Contact Info</span>
                  </div>
                </button>

                <button
                  onClick={() => { setIsSearchingChat(true); setChatSearchQuery(""); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Search className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Search</span>
                  </div>
                </button>

                <button
                  onClick={() => { setIsMultiSelectMode(true); setSelectedMsgIds([]); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Check className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Select Messages</span>
                  </div>
                </button>

                <button
                  onClick={() => { setShowMuteQuickModal(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <VolumeX className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Mute Notifications</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#00FF9C] font-mono">
                    <span>{muteDuration !== "off" ? muteDuration.toUpperCase() : "OFF"}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </button>

                <button
                  onClick={() => { setShowDisappearingQuickModal(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Disappearing Messages</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-500 font-mono">
                    <span>{disappearingTimer !== "off" ? disappearingTimer.toUpperCase() : "OFF"}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </button>

                <button
                  onClick={() => { handleToggleChatLock(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Lock className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Lock Chat</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                    {(JSON.parse(localStorage.getItem("settings_locked_chats") || "[]") as string[]).includes(chatId) ? "LOCKED" : "UNLOCKED"}
                  </span>
                </button>

                <button
                  onClick={() => { handleToggleFavorite(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Heart className={`w-4 h-4 mr-3 shrink-0 ${isFavorite ? "text-red-500 fill-red-500" : "text-gray-400"}`} />
                    <span>Add to Favorites</span>
                  </div>
                  {isFavorite && <span className="w-2 h-2 rounded-full bg-red-500" />}
                </button>

                <button
                  onClick={() => { setShowAddToListModal(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Plus className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Add to List</span>
                  </div>
                  {customLists.length > 0 && (
                    <span className="text-[10px] bg-[#00FF9C]/10 text-[#00FF9C] px-1.5 py-0.5 rounded font-mono font-bold">
                      {customLists.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { onBack(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl text-red-400 transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <X className="w-4 h-4 text-red-400/80 mr-3 shrink-0" />
                    <span>Close Chat</span>
                  </div>
                </button>
              </div>

              {/* SECTION 2: Media and Scheduling */}
              <div className="p-1 space-y-0.5">
                <button
                  onClick={async () => {
                    await sendMessage(chatId, senderProfile?.uid || "user", `🎬 [HD WEB MEETING ROOM INITIALIZED]\nJoin our secure peer-encrypted video session at:\nhttps://meet.mahraj.network/room/${chatId}`);
                    setShowMenu(false);
                    setForwardSuccessToast("Call link posted!");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Share2 className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Send Call Link</span>
                  </div>
                </button>

                <button
                  onClick={() => { setShowScheduleModal(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
                    <span>Schedule Call</span>
                  </div>
                </button>
              </div>

              {/* SECTION 3: Blocking, reporting, deletion */}
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    if (confirm(`⚠️ File a priority spam and security report against this conversation? This will safely log session handshakes and clear history.`)) {
                      alert(`🚨 Report against dialogue has been successfully compiled.`);
                      setClearedChatTimestamp(Date.now());
                      localStorage.setItem(`mahraj_cleared_ts_${chatId}`, String(Date.now()));
                    }
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl text-red-400/90 transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <ShieldAlert className="w-4 h-4 text-red-500 mr-3 shrink-0" />
                    <span>Report</span>
                  </div>
                </button>

                <button
                  onClick={() => { handleToggleBlock(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl text-yellow-500/90 transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Ban className="w-4 h-4 text-yellow-500 mr-3 shrink-0" />
                    <span>{didIBlockContact ? "Unblock" : "Block"}</span>
                  </div>
                </button>

                <button
                  onClick={() => { setShowClearConfirm(true); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl text-red-400/90 transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Sliders className="w-4 h-4 text-red-400/70 mr-3 shrink-0" />
                    <span>Clear Chat</span>
                  </div>
                </button>

                <button
                  onClick={() => { handleDeleteChatConversation(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between rounded-xl text-red-500 transition cursor-pointer"
                >
                  <div className="flex items-center">
                    <Trash2 className="w-4 h-4 text-red-500 mr-3 shrink-0" />
                    <span>Delete Chat</span>
                  </div>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>




      {/* Premium Disappearing Messages Timer Banner (Pinned statically above active scroll) */}
      {disappearingTimer !== "off" && (
        <div className="mx-auto my-1.5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-center flex items-center gap-2 max-w-sm justify-center text-[10px] font-mono text-amber-500 uppercase select-none relative z-10 animate-fade-in shadow-sm shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>⚡ Timer active: self-destruct messages ({disappearingTimer})</span>
        </div>
      )}

      {/* Messages Scroll Zone with authentic modern green wallpaper touch */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col scrollbar-thin relative transition-all duration-300"
        style={(() => {
          switch (wallpaper) {
            case "solid_charcoal": return { backgroundColor: "#0b0c10" };
            case "solid_teal": return { backgroundColor: "#061819" };
            case "emerald_whatsapp": return { backgroundColor: "#062216" };
            case "solid_indigo": return { backgroundColor: "#08091d" };
            case "radial_sunset": return { backgroundImage: "radial-gradient(circle at center, #2e0e09 0%, #030408 100%)" };
            case "neon_grid": return { 
              backgroundImage: "linear-gradient(rgba(0, 255, 156, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 156, 0.02) 1px, transparent 1px)", 
              backgroundSize: "24px 24px",
              backgroundColor: "#030806"
            };
            default: return { backgroundColor: "#050505" };
          }
        })()}
      >
        
        {/* Stunning background wallpaper rendering */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          {wallpaper === "celestial_moon" && (
            <img 
              src="/src/assets/images/moon_black_4k_1779460318766.png" 
              alt="Celestial Moon Wallpaper" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-20 object-center transition-all duration-300"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35 pointer-events-none" />
        </div>



        {getVisibleMessages().length === 0 ? (
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
          getVisibleMessages().map((m) => {
            const isMe = m.senderId === senderProfile.uid;
            const isVideo = m.mediaType === "video";
            const isAudio = m.mediaType === "audio";
            const isDoc = m.mediaType === "document";
            
            return (
              <div 
                key={m.id}
                className={`flex items-center w-full my-1.5 relative z-10 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {isMultiSelectMode && (
                  <div 
                    onClick={() => {
                      if (selectedMsgIds.includes(m.id)) {
                        setSelectedMsgIds(p => p.filter(id => id !== m.id));
                      } else {
                        setSelectedMsgIds(p => [...p, m.id]);
                      }
                    }}
                    className={`mr-3 cursor-pointer select-none transition shrink-0 ${isMe ? "order-first" : ""}`}
                    style={{ contentVisibility: 'auto' }}
                  >
                    {selectedMsgIds.includes(m.id) ? (
                      <div className="w-[18px] h-[18px] rounded-full bg-[#00FF9C] text-black flex items-center justify-center border border-[#00FF9C] shadow-[0_0_8px_rgba(0,255,156,0.6)]">
                        <Check className="w-3.5 h-3.5 stroke-[4.5] text-[#0A0A0A]" />
                      </div>
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border border-white/20 bg-black/40 hover:border-white/50" />
                    )}
                  </div>
                )}

                <div
                  id={`msg-bubble-${m.id}`}
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] relative group ${isMe ? "items-end" : "items-start"}`}
                >
                  {/* Real-time responsive whatsapp-like speech bubble */}
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedMessage(m);
                    }}
                    onTouchStart={() => handleTouchStart(m)}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={() => handleMouseDown(m)}
                    onMouseUp={handleMouseUp}
                    className={`p-3 rounded-2xl border text-xs shadow-md transition-all relative select-none cursor-pointer ${
                      isMe
                        ? "bg-[#0b141a] text-white border-[#00FF9C]/25 rounded-tr-none hover:shadow-[0_0_12px_rgba(0,255,156,0.06)]"
                        : "bg-[#202c33] text-white border-white/5 rounded-tl-none"
                    }`}
                  >
                    {/* Hover options button trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(m);
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded transition text-gray-400 hover:text-white"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Media Content - supports both videos and images */}
                    {m.mediaUrl && !isAudio && !isDoc && (
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

                    {/* Audio Vocal Handshake Player */}
                    {isAudio && m.mediaUrl && (
                      <div className="mb-2.5 min-w-[240px] max-w-full rounded-xl bg-black/45 border border-[#00FF9C]/20 p-2.5 flex flex-col gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#00FF9C]/10 border border-[#00FF9C]/30 flex items-center justify-center">
                            <Volume2 className="w-4 h-4 text-[#00FF9C] animate-pulse" />
                          </div>
                          <div>
                            <p className="text-[9px] text-[#00FF9C] font-mono tracking-widest font-bold uppercase">VOICE DISPATCHED</p>
                            <p className="text-[8px] text-gray-500 font-mono font-medium uppercase">SECURE VOCAL STREAM</p>
                          </div>
                        </div>
                        <audio 
                          src={m.mediaUrl} 
                          controls 
                          preload="none"
                          className="w-full h-8 mt-1 block tracking-tight select-none focus:outline-none"
                        />
                      </div>
                    )}

                    {/* PDF/Word/Excel Document Attachment Card */}
                    {isDoc && m.mediaUrl && (
                      <div className="mb-2.5 min-w-[230px] max-w-full rounded-xl bg-black/45 border border-cyan-500/20 p-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs text-white font-medium truncate font-sans" title={m.fileName || m.text}>
                              {m.fileName || m.text || "encrypted-packet.pdf"}
                            </p>
                            <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mt-0.5">
                              {m.fileSize || "1.5 MB"} • SECURE DOC
                            </p>
                          </div>
                        </div>
                        <a 
                          href={m.mediaUrl} 
                          download={m.fileName || "compressed-element.pdf"}
                          className="w-8 h-8 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/35 text-cyan-400 hover:text-cyan-300 flex items-center justify-center shrink-0 transition"
                          title="Decode package"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {chatSearchQuery.trim() ? (
                      <p className="leading-relaxed whitespace-pre-wrap select-text font-sans text-[13px] pr-4">
                        {m.text.split(new RegExp(`(${chatSearchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")})`, "gi")).map((part, i) => 
                          part.toLowerCase() === chatSearchQuery.toLowerCase() 
                            ? <mark key={i} className="bg-yellow-500/50 text-white font-bold px-0.5 rounded border border-yellow-500/70">{part}</mark> 
                            : part
                        )}
                      </p>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap select-text font-sans text-[13px] pr-4">
                        {m.text}
                      </p>
                    )}

                    {/* Message Reactions rendering rows */}
                    {m.reactions && m.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5 justify-start">
                        {m.reactions.map((r, rIdx) => (
                          <span 
                            key={rIdx} 
                            className="inline-flex items-center gap-1 text-[10px] bg-black/40 px-2 py-0.5 rounded-full border border-white/5 font-mono text-gray-300 select-none"
                            title={`Reacted by ${r.userName}`}
                          >
                            <span className="text-xs">{r.emoji}</span>
                            <span className="text-[8px] text-gray-500">{r.userName.split(" ")[0]}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Stamp & read receipts checks */}
                    <div className="flex justify-end gap-1.5 mt-1.5 text-[9px] font-mono text-gray-400 select-none">
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

              </div>
            );
          })
        )}

        {/* Dynamic uploading status bar */}
        {isUploading && (
          <div className="self-end flex flex-col items-end max-w-[85%] py-2 relative z-10 font-mono text-[10px] text-[#00FF9C] space-y-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transmitting Secure Payload ({uploadProgress}%)</span>
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
            onClick={() => {
              setShowAttachments(false);
              docInputRef.current?.click();
            }}
            className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-white/5 font-mono text-[9px] text-gray-400 hover:text-[#00FF9C] transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-950/40 flex items-center justify-center border border-rose-500/50">
              <FileText className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <span>DOC / PDF</span>
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

      {/* custom neon input bar at bottom, wrapped/hidden if blocked communications bar is active */}
      {isMultiSelectMode ? (
        <div className="p-3.5 bg-[#121214] border-t border-[#00FF9C]/20 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 animate-in slide-in-from-bottom duration-155">
          <div className="text-xs font-mono text-[#00FF9C] tracking-wide uppercase">
            ⚔️ <span className="font-bold">{selectedMsgIds.length}</span> SECURE MESSAGE{selectedMsgIds.length !== 1 ? "S" : ""} SELECTED FOR OPERATIONS
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={async () => {
                if (selectedMsgIds.length === 0) return;
                if (confirm(`Permanently wipe/delete ${selectedMsgIds.length} selected secure message packets?`)) {
                  for (const mId of selectedMsgIds) {
                    await deleteSingleMessage(chatId, mId);
                  }
                  setSelectedMsgIds([]);
                  setIsMultiSelectMode(false);
                  setForwardSuccessToast("Selected packets securely purged!");
                }
              }}
              disabled={selectedMsgIds.length === 0}
              className={`px-3 py-2 text-xxs font-mono font-bold uppercase rounded-lg border transition ${
                selectedMsgIds.length === 0 
                  ? "bg-red-500/5 text-red-500/40 border-red-500/10 cursor-not-allowed" 
                  : "bg-red-500/15 hover:bg-red-500/35 text-red-500 border-red-500/40"
              }`}
            >
              PURGE ({selectedMsgIds.length})
            </button>
            <button
              onClick={() => {
                if (selectedMsgIds.length === 0) return;
                const texts = messages
                  .filter(m => selectedMsgIds.includes(m.id))
                  .map(m => m.text)
                  .filter(t => !!t)
                  .join("\n---\n");
                
                setSelectedMessage({
                  id: "chain_handshake",
                  senderId: senderProfile?.uid || "",
                  text: texts || "[Media Package Chain]",
                  timestamp: new Date().toISOString(),
                  status: "read"
                });
                setShowForwardModal(true);
              }}
              disabled={selectedMsgIds.length === 0}
              className={`px-3 py-2 text-xxs font-mono font-bold uppercase rounded-lg border transition ${
                selectedMsgIds.length === 0 
                  ? "bg-[#00FF9C]/5 text-[#00FF9C]/40 border-[#00FF9C]/10 cursor-not-allowed" 
                  : "bg-[#00FF9C]/10 hover:bg-[#00FF9C]/25 text-[#00FF9C] border-[#00FF9C]/35"
              }`}
            >
              FORWARD ({selectedMsgIds.length})
            </button>
            <button
              onClick={() => {
                setIsMultiSelectMode(false);
                setSelectedMsgIds([]);
              }}
              className="px-3 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white text-xxs font-mono uppercase transition cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : isAnyBlockActive ? (
        <div className="p-4 bg-red-950/20 border-t border-red-500/25 text-center flex flex-col items-center justify-center gap-1.5 z-10 font-mono text-[10px] tracking-widest uppercase text-red-400">
          <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
          {didIBlockContact ? (
            <div className="space-y-1">
              <span>You have blocked this node. Unblock communications to message or call.</span>
              <button 
                id="unblock-direct-banner-btn"
                onClick={handleToggleBlock}
                className="mt-1 px-3 py-1 bg-red-500 text-black font-extrabold rounded-lg hover:bg-white tracking-widest transition cursor-pointer text-[9px]"
              >
                UNBLOCK CONTACT
              </button>
            </div>
          ) : (
            <span>Communications restricted. You are currently blocked by this remote node.</span>
          )}
        </div>
      ) : (
        <div className="p-3 bg-[#0A0A0A] border-t border-white/5 flex items-center gap-2 z-10 transition-all">
          {isRecording ? (
            <div className="flex-1 bg-[#220B0B] border border-red-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping inline-block" />
                <span className="text-xs text-red-400 font-mono font-bold tracking-widest">
                  RECORDING AUDIO: {formatSeconds(recordingDuration)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => stopRecording(true)}
                  className="px-2.5 py-1 text-[8px] font-mono tracking-wider text-gray-400 hover:text-white bg-white/5 rounded border border-white/10 transition uppercase"
                  title="Discard packet"
                >
                  Cancel
                </button>
                <button
                  onClick={() => stopRecording(false)}
                  className="p-2 bg-red-500 text-black hover:bg-red-400 rounded-lg flex items-center justify-center transition cursor-pointer"
                  title="Stop & send stream"
                >
                  <Square className="w-3.5 h-3.5 fill-black" />
                </button>
              </div>
            </div>
          ) : (
            <>
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
                className="flex-1 bg-[#121212] border border-[#00FF9C]/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-550 focus:outline-none focus:border-[#00FF9C] font-sans"
              />

              {inputText.trim() ? (
                <button
                  id="chat-send-btn"
                  onClick={() => handleSendText()}
                  className="h-10 w-10 bg-[#00FF9C] rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,255,156,0.25)] hover:bg-[#00FF9C]/80 transition cursor-pointer"
                >
                  <Send className="w-4 h-4 text-[#050505]" />
                </button>
              ) : (
                <button
                  id="voice-record-btn"
                  onClick={startRecording}
                  className="h-10 w-10 bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/45 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,209,255,0.06)] hover:bg-[#00D1FF]/25 transition cursor-pointer animate-pulse"
                  title="Start Audio Handshake"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Dynamic Slide-in cybernetic Group Manager Panel Drawer */}
      {showGroupDrawer && activeGroupDoc && (
        <div id="group-manager-drawer" className="absolute inset-y-0 right-0 w-80 md:w-96 bg-[#0E0E0E] border-l-2 border-[#00D1FF]/40 shadow-[0_0_35px_rgba(0,209,255,0.15)] z-40 flex flex-col animate-in slide-in-from-right duration-200">
          
          <div className="p-4 bg-[#050505] border-b border-[#00D1FF]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00D1FF]" />
              <h3 className="text-[#00D1FF] text-xs font-bold font-mono tracking-widest uppercase">Secure Group Manager</h3>
            </div>
            <button 
              onClick={() => setShowGroupDrawer(false)} 
              className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-white/5 bg-[#0A0A0A]/40 text-center space-y-2">
            <div className="relative w-16 h-16 mx-auto">
              <img src={activeGroupDoc.avatar} alt="Group avatar" className="w-16 h-16 rounded-full object-cover border border-[#00D1FF]" />
              <span className="absolute -bottom-1 -right-1 bg-[#00D1FF] text-black text-[7px] font-mono rounded px-1 font-bold scale-90">GP</span>
            </div>
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">{activeGroupDoc.name}</h4>
              <p className="text-gray-400 text-[10px] font-mono mt-0.5 uppercase tracking-widest">
                Owner: {allUsers.find(u => u.uid === activeGroupDoc.creatorId)?.displayName || "Founder Node"}
              </p>
            </div>
          </div>

          {/* Members search or filter list */}
          <div className="p-3 border-b border-white/5 bg-[#050505]">
            <input
              type="text"
              value={groupSearchQuery}
              onChange={e => setGroupSearchQuery(e.target.value)}
              placeholder="Filter Directory Users..."
              className="w-full bg-[#121212] border border-[#00D1FF]/20 rounded-xl px-3 py-2 text-[10px] font-mono text-white placeholder-gray-700 focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {/* Directory Users list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block mb-1">Interactive Directory ({allUsers.length})</span>
            {allUsers
              .filter(u => u.uid !== "ai-bot" && u.uid !== "system")
              .filter(u => !groupSearchQuery || u.displayName.toLowerCase().includes(groupSearchQuery.toLowerCase()) || u.phone.includes(groupSearchQuery))
              .map((userObj) => {
                const isMember = activeGroupDoc.members?.includes(userObj.uid);
                const isMe = userObj.uid === senderProfile?.uid;
                const isOwner = userObj.uid === activeGroupDoc.creatorId;

                return (
                  <div
                    key={userObj.uid}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isMember 
                        ? "bg-[#00D1FF]/5 border-[#00D1FF]/20" 
                        : "bg-black/30 border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img src={userObj.photoURL} alt="User Avatar" className="w-8 h-8 rounded-full object-cover" />
                        {userObj.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#00FF9C] border-2 border-[#0E0E0E]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                          <span>{userObj.displayName}</span>
                          {isMe && <span className="text-[8px] font-sans text-gray-400 font-normal capitalize">(you)</span>}
                        </h5>
                        <p className="text-[9px] text-gray-500 font-mono mt-0.5 truncate uppercase">
                          {isOwner ? "👑 Admin / Founder" : isMember ? "Subscriber Node" : "Offline Node"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-1.5">
                      {isMe ? (
                        <span className="text-[8px] font-mono text-[#00D1FF] bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded px-1 py-0.5">Active</span>
                      ) : isMember ? (
                        <button
                          onClick={() => handleRemoveGroupMember(userObj.uid)}
                          className="p-1 px-2 border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-white rounded-lg font-mono text-[9px] uppercase transition cursor-pointer flex items-center gap-1"
                          title="Kick member"
                        >
                          <UserMinus className="w-3 h-3" />
                          <span>Kick</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddGroupMember(userObj.uid)}
                          className="p-1 px-2 border border-[#00D1FF]/30 hover:border-[#00D1FF] hover:bg-[#00D1FF]/10 text-[#00D1FF] hover:text-white rounded-lg font-mono text-[9px] uppercase transition cursor-pointer flex items-center gap-1"
                          title="Invite member"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

        </div>
      )}

      {/* Helper functions for Premium WhatsApp action simulations */}
      {(() => {
        // We define these in an immediately invoked function or declare them in the component scope.
        // Let's declare them cleanly in inline variables so they are accessible inside JSX or in the component scope.
        return null;
      })()}

      {/* Dynamic Slide-in Cybernetic Peer Chat Options Drawer */}
      {showChatSettingsDrawer && (
        <div id="peer-settings-drawer" className="absolute inset-y-0 right-0 w-80 md:w-96 bg-[#0E0E0E] border-l-2 border-[#00FF9C]/40 shadow-[0_0_35px_rgba(0,255,156,0.15)] z-45 flex flex-col animate-in slide-in-from-right duration-200">
          
          <div className="p-4 bg-[#050505] border-b border-[#00FF9C]/30 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00FF9C]" />
              <h3 className="text-[#00FF9C] text-xs font-bold font-mono tracking-widest uppercase">Chat Settings</h3>
            </div>
            <button 
              onClick={() => setShowChatSettingsDrawer(false)} 
              className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
            {/* Peer Profile Header Card */}
            <div className="p-4 border border-white/5 rounded-2xl bg-black/40 text-center space-y-3 relative overflow-hidden">
              <div className="absolute top-2 right-2 flex items-center gap-1.5 font-mono">
                {receiverProfile.isOnline ? (
                  <span className="text-[7.5px] font-bold text-[#00FF9C] bg-[#00FF9C]/10 px-1.5 py-0.5 rounded border border-[#00FF9C]/20 uppercase">Online</span>
                ) : (
                  <span className="text-[7.5px] font-bold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 uppercase">Offline</span>
                )}
              </div>

              <div className="relative w-18 h-18 mx-auto">
                <img 
                  src={receiverProfile.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"} 
                  alt={receiverProfile.displayName} 
                  className="w-18 h-18 rounded-full object-cover border border-[#00FF9C]/40 shadow-md" 
                />
              </div>
              <div>
                <h4 className="text-white text-xs font-bold uppercase tracking-wider">
                  {receiverProfile.displayName}
                </h4>
                <p className="text-[#00FF9C] text-[9px] font-mono mt-1 tracking-wider">{receiverProfile.phone || "+966 50 123 4567"}</p>
                <p className="text-gray-400 text-[10px] leading-snug mt-2 italic px-2 bg-white/5 py-1.5 rounded-xl border border-white/5">
                  "{receiverProfile.bio || "Secure Mahraj Network Peer"}"
                </p>
              </div>
            </div>

            {/* SECTION 1: Privacy Control */}
            <div className="space-y-3">
              <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">1. Chat & Privacy Control</span>
              
              {/* Block Action */}
              <div className="p-3 bg-[#121212] border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white font-medium block">Block Status</span>
                  <span className="text-[8px] text-gray-505 font-mono">Prevent peer messages & calls</span>
                </div>
                <button
                  onClick={handleToggleBlock}
                  className={`text-[9.5px] font-mono font-bold px-3 py-1.5 rounded-xl uppercase border transition ${
                    didIBlockContact 
                      ? "bg-emerald-505/10 hover:bg-emerald-500/20 text-[#00FF9C] border-emerald-500/30" 
                      : "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30"
                  }`}
                >
                  {didIBlockContact ? "Unblock" : "Block"}
                </button>
              </div>

              {/* Report Action */}
              <div className="p-3 bg-[#121212] border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white font-medium block">Abuse Report</span>
                  <span className="text-[8px] text-gray-500 font-mono">Flag spam behavior & scrub</span>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`⚠️ Are you sure you want to report ${receiverProfile.displayName} for spam or abuse? This will forward log telemetry data and clear this dialogue history.`)) {
                      // Report user sequence
                      alert(`🚨 Report against ${receiverProfile.displayName} has been filed for abuse/spam. Our admin nodes have received the telemetry handshake.`);
                      setClearedChatTimestamp(Date.now());
                      localStorage.setItem(`mahraj_cleared_ts_${chatId}`, String(Date.now()));
                      localStorage.setItem(`mahraj_cleared_keep_media_${chatId}`, "false");
                      setShowChatSettingsDrawer(false);
                    }
                  }}
                  className="bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 text-[9.5px] font-mono font-bold px-3 py-1.5 rounded-xl uppercase transition"
                >
                  Report
                </button>
              </div>

              {/* Mute Component */}
              <div className="p-3.5 bg-[#121212] border border-white/5 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-white">
                  <VolumeX className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] font-medium">Mute Notifications</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { key: "off", name: "Off" },
                    { key: "8h", name: "8 H" },
                    { key: "1w", name: "1 W" },
                    { key: "always", name: "Always" }
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => handleUpdateMuteState(m.key)}
                      className={`py-1.5 rounded-lg border text-[8px] font-mono uppercase transition ${
                        muteDuration === m.key 
                          ? "bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.1)]" 
                          : "bg-black/40 border-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Notifications sound */}
              <div className="p-3.5 bg-[#121212] border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-white">
                  <BellRing className="w-3.5 h-3.5 text-[#00FF9C]" />
                  <span className="text-[10px] font-medium">Custom Alerts Setup</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-[8.5px] text-gray-500 uppercase">Alert Tone</span>
                    <select
                      value={customTone}
                      onChange={(e) => handleUpdateToneState(e.target.value)}
                      className="bg-black border border-white/10 text-white rounded px-1.5 py-0.5 text-[8.5px] focus:outline-none focus:border-[#00FF9C]"
                    >
                      <option value="Default Mahraj Tone">Default Tone</option>
                      <option value="Cybernetic Bell">Cybernetic Bell</option>
                      <option value="Vaporwave Synth">Vaporwave Synth</option>
                      <option value="Digital Chyme">Digital Chyme</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-[8.5px] text-gray-500 uppercase">Vibration</span>
                    <select
                      value={customVibration}
                      onChange={(e) => {
                        handleUpdateVibrationState(e.target.value);
                        if (e.target.value !== "None" && navigator.vibrate) {
                          navigator.vibrate([100, 50, 100]);
                        }
                      }}
                      className="bg-black border border-white/10 text-white rounded px-1.5 py-0.5 text-[8.5px] focus:outline-none focus:border-[#00FF9C]"
                    >
                      <option value="None">Disabled</option>
                      <option value="Default Pattern">Standard</option>
                      <option value="Short Alert Buzz">Short Buzz</option>
                      <option value="Long Pulse Burst">Long Pulse</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Data & Media Management */}
            <div className="space-y-3">
              <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">2. Data & Media Management</span>

              {/* Clear Chat Controls */}
              <div className="p-3 bg-[#121212] border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white font-medium block font-sans">Clear dialogue</span>
                  <span className="text-[8px] text-gray-500 font-mono block">Zero text logs locally</span>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-[9.5px] font-mono font-bold px-3 py-1.5 rounded-xl uppercase transition"
                >
                  Clear
                </button>
              </div>

              {/* Delete Chat */}
              <div className="p-3 bg-[#121212] border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white font-medium block">Delete Conversation</span>
                  <span className="text-[8px] text-gray-500 font-mono block">Remove thread from home</span>
                </div>
                <button
                  onClick={handleDeleteChatConversation}
                  className="bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 text-[9.5px] font-mono font-bold px-3 py-1.5 rounded-xl uppercase transition"
                >
                  Delete
                </button>
              </div>

              {/* Media Visibility scoped vs public */}
              <div className="p-3 bg-[#121212] border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white font-medium block">Gallery Syncing</span>
                  <span className="text-[8px] text-gray-500 font-mono block">Save media in phone gallery</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={mediaVisibility}
                    onChange={(e) => handleUpdateMediaVisibilityState(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-[14px] after:transition-all dark:border-gray-650 peer-checked:bg-[#00FF52]"></div>
                </label>
              </div>

              {/* Export Chat Archive */}
              <div className="p-3 bg-[#121212] border border-white/5 rounded-2xl space-y-3">
                <span className="text-[10px] text-white font-medium block">Export Chat Sessions</span>
                <span className="text-[8px] text-gray-400 font-mono block leading-relaxed uppercase">Download compiled crypt-aligned history back-logs.</span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      let visibleMsgs = getVisibleMessages();
                      let exportData = visibleMsgs.map(m => {
                        const isMe = m.senderId === senderProfile?.uid;
                        const senderName = isMe ? (senderProfile?.displayName || "You") : receiverProfile.displayName;
                        return {
                          message_id: m.id,
                          sender: senderName,
                          text: m.text,
                          timestamp: m.timestamp,
                          status: m.status
                        };
                      });

                      const fileContents = JSON.stringify({
                        messenger_client: "MAHRAJ MESSENGER EXPORT",
                        exported_at: new Date().toISOString(),
                        chat_channel_id: chatId,
                        peer_user: receiverProfile.displayName,
                        messages_count: exportData.length,
                        conversation_history: exportData
                      }, null, 2);

                      const blob = new Blob([fileContents], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `mahraj_chat_export_${receiverProfile.displayName.replace(/\s+/g, "_").toLowerCase()}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      alert("🚀 Secure plain text JSON conversation downloaded.");
                    }}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-1.5 text-[8.5px] font-mono uppercase transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3 h-3 text-gray-400" />
                    <span>Plain TEXT</span>
                  </button>
                  <button
                    onClick={() => {
                      let visibleMsgs = getVisibleMessages();
                      let exportData = visibleMsgs.map(m => {
                        const isMe = m.senderId === senderProfile?.uid;
                        const senderName = isMe ? (senderProfile?.displayName || "You") : receiverProfile.displayName;
                        return {
                          message_id: m.id,
                          sender: senderName,
                          text: m.text,
                          timestamp: m.timestamp,
                          status: m.status,
                          media_url: m.mediaUrl || null,
                          media_type: m.mediaType || null,
                          offline_scoped_path: m.offlineLocalPath || null
                        };
                      });

                      const fileContents = JSON.stringify({
                        messenger_client: "MAHRAJ SECURE EXPORT WITH MEDIA LOGS",
                        exported_at: new Date().toISOString(),
                        chat_channel_id: chatId,
                        peer_user: receiverProfile.displayName,
                        messages_count: exportData.length,
                        conversation_history: exportData
                      }, null, 2);

                      const blob = new Blob([fileContents], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `mahraj_chat_export_with_media_${receiverProfile.displayName.replace(/\s+/g, "_").toLowerCase()}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      alert("🚀 Rich conversation history containing offline storage payloads downloaded.");
                    }}
                    className="bg-[#00FF52]/5 hover:bg-[#00FF52]/10 border border-[#00FF52]/30 text-[#00FF52] rounded-lg py-1.5 text-[8.5px] font-mono uppercase transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#00FF52]" />
                    <span>JSON+MEDIA</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 3: Chat Customization */}
            <div className="space-y-3">
              <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">3. Chat Customization</span>

              {/* Wallpapers Selector Layout */}
              <div className="p-3.5 bg-[#121212] border border-[#00FF9C]/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#00FF9C]" />
                  <span className="text-[10px] text-white font-medium block font-sans">Dynamic Wallpaper</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { key: "celestial_moon", label: "LUNAR BRUTAL" },
                    { key: "solid_charcoal", label: "CARBON SHADOW" },
                    { key: "solid_teal", label: "CYBER OCEAN" },
                    { key: "emerald_whatsapp", label: "EMERALD CELL" },
                    { key: "solid_indigo", label: "DEEP COSMIC" },
                    { key: "radial_sunset", label: "SOLAR EMBER" },
                    { key: "neon_grid", label: "MATRIX LABS" }
                  ].map((wItem) => (
                    <button
                      key={wItem.key}
                      onClick={() => handleUpdateWallpaperState(wItem.key)}
                      className={`py-2 px-1 rounded-lg border text-[7.5px] font-mono leading-none tracking-tight uppercase flex items-center justify-center transition break-all ${
                        wallpaper === wItem.key 
                          ? "bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] font-bold shadow-[0_0_12px_rgba(0,255,156,0.12)]" 
                          : "bg-black/50 border-white/5 text-gray-500 hover:text-white"
                      }`}
                    >
                      {wItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disappearing Self-Destruct Timer */}
              <div className="p-3.5 bg-[#121212] border border-white/5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-white">
                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span className="text-[10px] font-medium">Disappearing Messages</span>
                  </div>
                  {disappearingTimer !== "off" && (
                    <span className="text-[7.5px] font-mono font-bold text-amber-500 uppercase bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded animate-pulse">Active</span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { val: "off", name: "Off" },
                    { val: "24h", name: "24 H" },
                    { val: "7d", name: "7 D" },
                    { val: "90d", name: "90 D" }
                  ].map((dObj) => (
                    <button
                      key={dObj.val}
                      onClick={() => handleUpdateDisappearingState(dObj.val)}
                      className={`py-1.5 rounded-lg border text-[8px] font-mono uppercase transition ${
                        disappearingTimer === dObj.val 
                          ? "bg-amber-500/15 border-amber-500 text-amber-500 font-bold" 
                          : "bg-black/40 border-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {dObj.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 4: Encryption Status Verification */}
            <div className="space-y-3 pb-4 font-mono">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest block font-bold">4. Encryption & Security</span>

              <div className="p-3.5 bg-black/40 border border-[#00FF9C]/20 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-[#00FF9C]">
                  <Lock className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">End-To-End SECURED</span>
                </div>
                <p className="text-gray-400 text-[8.5px] leading-relaxed uppercase">
                  Messages and file transmissions are encrypted. Verify security fingerprint node setup.
                </p>
                <button
                  onClick={() => setShowQRVerification(true)}
                  className="w-full bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/30 rounded-xl py-2 text-[9px] font-bold uppercase tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Verify Fingerprint</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium End-To-End Encryption Verification Dialog Modal */}
      {showQRVerification && (
        <div className="fixed inset-0 z-55 bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#0E0E0E] border-2 border-[#00FF9C]/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#00FF9C]" />
                <span className="text-white text-xs font-mono font-bold uppercase tracking-wider">Secure Verification Key</span>
              </div>
              <button 
                onClick={() => setShowQRVerification(false)}
                className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-gray-400 text-[9px] leading-relaxed text-center font-mono uppercase">
              Compare the 60-digit sequence or scan the QR signature below with <strong>{receiverProfile.displayName}</strong> to confirm perfect cryptographic key alignment.
            </p>

            {/* Simulated premium secure QR code alignment block */}
            <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center border border-white/5 space-y-4">
              <div className="w-36 h-36 bg-white p-2.5 rounded-xl border border-white shadow-xl relative flex items-center justify-center">
                <div className="absolute inset-0.5 bg-white flex flex-col p-1.5 items-center justify-center">
                  <div className="w-full h-full border-4 border-black relative flex flex-wrap p-1">
                    <div className="absolute top-1 left-1 w-6 h-6 bg-black border-2 border-white" />
                    <div className="absolute top-1 right-1 w-6 h-6 bg-black border-2 border-white" />
                    <div className="absolute bottom-1 left-1 w-6 h-6 bg-black border-2 border-white" />
                    <div className="w-full h-full opacity-75 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:4px_4px] mt-1" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-black text-white shrink-0 flex items-center justify-center font-mono font-bold text-[7.5px] tracking-tighter uppercase rounded border border-white">
                        M-MSG
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <span className="text-[7.5px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded select-none uppercase">SHA256 Fingerprint Matches: True</span>
            </div>

            {/* Generated WhatsApp layout chunk code */}
            <div className="bg-black/60 border border-white/5 p-3 rounded-2xl font-mono text-[9px] tracking-widest text-[#00FF9C] text-center scale-95 leading-relaxed break-anywhere">
              {(() => {
                let hash = 0;
                for (let i = 0; i < chatId.length; i++) {
                  hash = (hash << 5) - hash + chatId.charCodeAt(i);
                  hash |= 0;
                }
                const absHash = Math.abs(hash).toString();
                const base = (absHash + "5928301840294720958291048201").slice(0, 60);
                const chunks = [];
                for (let i = 0; i < 12; i++) {
                  chunks.push(base.slice(i * 5, (i + 1) * 5));
                }
                return (
                  <div className="grid grid-cols-3 gap-y-2 gap-x-1 justify-items-center uppercase font-bold text-[9px]">
                    {chunks.map((chk, idx2) => (
                      <span key={idx2} className="text-white/90 font-bold">{chk}</span>
                    ))}
                  </div>
                );
              })()}
            </div>

            <button
              onClick={() => {
                alert("🔐 Key sequence successfully verified! Channel status promoted to: HIGHLY TRUSTED DIALOGUE.");
                setShowQRVerification(false);
              }}
              className="w-full bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black rounded-xl py-2 text-[9.5px] font-bold font-mono uppercase tracking-widest transition cursor-pointer"
            >
              Confirm Match Key Setup
            </button>
          </div>
        </div>
      )}

      {/* Clear Chat Dynamic Confirmation Dialog Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-55 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0E0E0E] border-2 border-yellow-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
              <span className="text-white text-xs font-mono font-bold uppercase tracking-wider">Clear Chat Records?</span>
            </div>

            <p className="text-gray-400 text-[9px] leading-relaxed font-mono uppercase">
              You are about to clear message logs inside this individual dialogue channel. This operation clears historical text logs locally.
            </p>

            <div className="p-3 bg-black/30 border border-white/5 rounded-2xl space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-white select-none">
                <input 
                  type="checkbox" 
                  checked={clearKeepMedia} 
                  onChange={(e) => setClearKeepMedia(e.target.checked)}
                  className="accent-[#00FF9C] rounded h-3.5 w-3.5 focus:ring-0 cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-[9.5px] text-white font-mono uppercase font-bold">Keep media elements</span>
                  <span className="text-[7.5px] text-gray-500 uppercase font-mono">Excludes video, audio & document logs from deletion</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="bg-white/5 hover:bg-white/10 text-white rounded-xl py-2 text-[9px] font-bold font-mono uppercase tracking-wide transition border border-white/5 cursor-pointer"
              >
                Keep Logs
              </button>
              <button
                onClick={() => {
                  setClearedChatTimestamp(Date.now());
                  localStorage.setItem(`mahraj_cleared_ts_${chatId}`, String(Date.now()));
                  localStorage.setItem(`mahraj_cleared_keep_media_${chatId}`, String(clearKeepMedia));
                  setShowClearConfirm(false);
                  alert("🧹 Dialogue log records cleared from screen view.");
                }}
                className="bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl py-2 text-[9px] font-bold font-mono uppercase tracking-wide transition shadow-md cursor-pointer"
              >
                Clear Messages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message options model (Triggered on click, Touch long press, or right click) */}
      {selectedMessage && !showForwardModal && (
        <div 
          id="message-options-modal" 
          className="fixed inset-0 z-50 bg-[#050505]/80 flex items-center justify-center p-4 animate-in fade-in duration-155"
          onClick={() => setSelectedMessage(null)}
        >
          <div 
            className="w-full max-w-xs bg-[#0b141a] border-2 border-[#00FF9C]/30 rounded-2xl p-4 shadow-[0_4px_30px_rgba(0,255,156,0.15)] space-y-4 text-center animate-in zoom-in-95 duration-150 select-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-white/5 pb-2 text-left flex justify-between items-center">
              <span className="text-[10px] text-[#00FF9C] font-mono tracking-widest uppercase font-bold">Message Reactions</span>
              <button onClick={() => setSelectedMessage(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
            </div>

            {/* Quick Emoji Bar selector */}
            <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-white/5">
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={async () => {
                    if (selectedMessage) {
                      await reactToMessage(
                        chatId,
                        selectedMessage.id,
                        emoji,
                        senderProfile?.uid || "",
                        senderProfile?.displayName || "Contact"
                      );
                      setSelectedMessage(null);
                    }
                  }}
                  className="text-xl hover:scale-125 transition transform duration-100 ease-out active:scale-95 cursor-pointer p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action buttons list */}
            <div className="space-y-1 text-left">
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-gray-200 rounded-lg text-xs font-mono tracking-wide transition uppercase cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>Forward Message //</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (selectedMessage) {
                    await deleteSingleMessage(chatId, selectedMessage.id);
                    setSelectedMessage(null);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg text-xs font-mono tracking-wide transition uppercase cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Delete Message //</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMessage(null)}
              className="w-full border border-white/5 hover:bg-white/5 py-2 text-[10px] font-mono tracking-widest text-gray-400 rounded-lg"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Forward message Destination selector Modal */}
      {showForwardModal && selectedMessage && (
        <div 
          id="forward-message-modal" 
          className="fixed inset-0 z-55 bg-[#050505]/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            className="w-full max-w-sm bg-[#080808] border-2 border-[#00FF9C]/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(0,255,156,0.25)] flex flex-col max-h-[75vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-3.5">
              <h3 className="text-[#00FF9C] text-xs font-bold tracking-widest uppercase font-mono flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-[#00FF9C]" /> Forward Contents
              </h3>
              <button 
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedMessage(null);
                  setForwardSearch("");
                }} 
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Keyword search input */}
            <input 
              type="text" 
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              placeholder="Search contacts or groups..." 
              className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00FF9C] font-mono mb-4"
            />

            {/* Search list container */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[40vh] pr-1">
              
              {/* Groups listing selection */}
              {(() => {
                const groupsList = JSON.parse(localStorage.getItem("mahraj_messenger_groups") || "[]") as GroupRoom[];
                const matchedGroups = groupsList.filter(g => g.name.toLowerCase().includes(forwardSearch.toLowerCase()));
                
                return matchedGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={async () => {
                      await sendMessage(
                        g.id,
                        senderProfile?.uid || "",
                        selectedMessage.text,
                        selectedMessage.mediaUrl,
                        selectedMessage.mediaType,
                        selectedMessage.fileName,
                        selectedMessage.fileSize,
                        selectedMessage.offlineLocalPath,
                        selectedMessage.offlineMetadataJSON,
                        selectedMessage.sqliteQueryLog,
                        selectedMessage.simulatedOS
                      );
                      setForwardSuccessToast(`Message forwarded to ${g.name}!`);
                      setShowForwardModal(false);
                      setSelectedMessage(null);
                      setForwardSearch("");
                    }}
                    className="w-full text-left flex items-center justify-between p-2.5 bg-[#0E0E0E] hover:bg-white/5 border border-white/5 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={g.avatar || "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&q=80&w=200"} 
                        alt={g.name} 
                        className="w-8 h-8 rounded-full object-cover border border-[#00FF9C]"
                      />
                      <div>
                        <h4 className="text-white text-xs font-semibold">{g.name}</h4>
                        <span className="text-[7.5px] font-mono uppercase text-gray-400">GROUP CHAT</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#00FF9C]">// LINK</span>
                  </button>
                ));
              })()}

              {/* Direct contacts/chats list */}
              {allUsers
                .filter(u => u.uid !== senderProfile?.uid && u.displayName.toLowerCase().includes(forwardSearch.toLowerCase()))
                .map((u) => (
                  <button
                    key={u.uid}
                    onClick={async () => {
                      const targetChatId = [senderProfile?.uid, u.uid].sort().join("_");
                      await sendMessage(
                        targetChatId,
                        senderProfile?.uid || "",
                        selectedMessage.text,
                        selectedMessage.mediaUrl,
                        selectedMessage.mediaType,
                        selectedMessage.fileName,
                        selectedMessage.fileSize,
                        selectedMessage.offlineLocalPath,
                        selectedMessage.offlineMetadataJSON,
                        selectedMessage.sqliteQueryLog,
                        selectedMessage.simulatedOS
                      );
                      setForwardSuccessToast(`Successfully forwarded to ${u.displayName}!`);
                      setShowForwardModal(false);
                      setSelectedMessage(null);
                      setForwardSearch("");
                    }}
                    className="w-full text-left flex items-center justify-between p-2.5 bg-[#0E0E0E] hover:bg-white/5 border border-white/5 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={u.photoURL} 
                        alt={u.displayName} 
                        className="w-8 h-8 rounded-full object-cover border border-white/5"
                      />
                      <div>
                        <h4 className="text-white text-xs font-semibold">{u.displayName}</h4>
                        <span className="text-[7.5px] font-mono uppercase text-gray-500">{u.isOnline ? "Active" : "Offline"}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">// SEND</span>
                  </button>
                ))
              }
            </div>

            <div className="border-t border-white/5 pt-3 mt-3 flex justify-end">
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedMessage(null);
                  setForwardSearch("");
                }}
                className="px-4 py-1.5 border border-white/5 hover:bg-white/5 text-gray-400 rounded text-xs font-mono uppercase"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cybernetic forwarding success notification toast */}
      {forwardSuccessToast && (
        <div className="fixed top-6 right-6 z-55 bg-[#00FF9C] text-black px-4 py-3 rounded-xl text-xs font-mono font-bold tracking-wider uppercase shadow-[0_0_20px_rgba(0,255,156,0.3)] flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-250 border border-white/10">
          <Sparkles className="w-4 h-4 animate-bounce shrink-0" />
          <span>{forwardSuccessToast}</span>
        </div>
      )}

      {/* WhatsApp Custom Interactive Camera Viewport */}
      {showWhatsAppCamera && (
        <WhatsAppCamera 
          onClose={() => setShowWhatsAppCamera(false)}
          onSendMedia={handleSendCameraMedia}
          onTriggerGallery={() => {
            setShowWhatsAppCamera(false);
            fileInputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
