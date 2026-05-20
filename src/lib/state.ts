import { 
  db, 
  auth, 
  isMockFirebase, 
  handleFirestoreError, 
  OperationType 
} from "../firebase";
import { 
  UserProfile, 
  ChatRoom, 
  Message, 
  StatusStory, 
  CallLog 
} from "../types";
import { 
  doc, 
  collection, 
  setDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  serverTimestamp
} from "firebase/firestore";

// --- HELPERS FOR LOCAL STORAGE REAL-TIME STATE ---
const STORAGE_PREFIX = "mahraj_messenger_";

function getLocal<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(STORAGE_PREFIX + key);
  return data ? JSON.parse(data) : defaultValue;
}

function setLocal<T>(key: string, value: T) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  window.dispatchEvent(new Event("storage_sync_" + key));
}

// Global active current user reference (used when mock authentication is selected)
export function getActiveLocalUser(): UserProfile | null {
  return getLocal<UserProfile | null>("current_user", null);
}

export function setActiveLocalUser(user: UserProfile | null) {
  setLocal<UserProfile | null>("current_user", user);
}

// Initialize pre-built starter contacts/accounts so the user doesn't have an empty screen
export const STARTER_USERS: Record<string, UserProfile> = {
  "ai-bot": {
    uid: "ai-bot",
    displayName: "MAHRAJ AI Engine",
    photoURL: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200",
    bio: "I am MAHRAJ's neural model companion and senior Flutter compiler guide! Chat with me live.",
    phone: "+91 99999 11111",
    isOnline: true
  },
  "syed-sahab": {
    uid: "syed-sahab",
    displayName: "Syed Ashraf (CEO)",
    photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    bio: "Pristine coding and pixel-perfect Neon Black designs. Flutter is absolute peak performance.",
    phone: "+91 91111 88888",
    isOnline: true
  },
  "zoya-khan": {
    uid: "zoya-khan",
    displayName: "Zoya Khan (Design Lead)",
    photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
    bio: "Busy shaping Neon interface graphics. Check out my status story!",
    phone: "+91 77777 55555",
    isOnline: false
  }
};

// Initial setup helper to populate localStorage with some pretty developer profiles
export function initializeLocalDatabase() {
  const users = getLocal<Record<string, UserProfile>>("users", {});
  if (Object.keys(users).length === 0) {
    setLocal<Record<string, UserProfile>>("users", STARTER_USERS);
    
    // Add a couple starter stories/statuses
    const initialStories: StatusStory[] = [
      {
        id: "story-1",
        userId: "zoya-khan",
        userName: "Zoya Khan",
        userAvatar: STARTER_USERS["zoya-khan"].photoURL,
        text: "Building the custom neon theme styles for MAHRAJ 🟢",
        mediaUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=600",
        timestamp: new Date().toISOString()
      },
      {
        id: "story-2",
        userId: "syed-sahab",
        userName: "Syed Ashraf",
        userAvatar: STARTER_USERS["syed-sahab"].photoURL,
        text: "Just deployed our zero-trust firestore security guard 🛡️ Check our specs!",
        mediaUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=600",
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    setLocal<StatusStory[]>("stories", initialStories);
  }
}

// --- USER PROFILE OPERATIONS ---
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (!isMockFirebase) {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, "users", profile.uid), {
        uid: profile.uid,
        displayName: profile.displayName,
        phone: profile.phone,
        bio: profile.bio || "Available on MAHRAJ Messenger",
        photoURL: profile.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
        isOnline: profile.isOnline ?? true,
        lastSeen: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const users = getLocal<Record<string, UserProfile>>("users", {});
    users[profile.uid] = { ...profile, lastSeen: new Date().toISOString() };
    setLocal("users", users);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isMockFirebase) {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        return snap.data() as UserProfile;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
      return null;
    }
  } else {
    const users = getLocal<Record<string, UserProfile>>("users", {});
    return users[uid] || null;
  }
}

export function getAllUsersLocal(): UserProfile[] {
  const users = getLocal<Record<string, UserProfile>>("users", {});
  return Object.values(users);
}

// --- REAL-TIME CHATS LISTENER ---
export function listenChats(uid: string, onUpdate: (chats: ChatRoom[]) => void): () => void {
  if (!isMockFirebase) {
    const path = "chats";
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid)
    );
    return onSnapshot(q, (snapshot) => {
      const chatRooms: ChatRoom[] = [];
      snapshot.forEach((doc) => {
        chatRooms.push(doc.data() as ChatRoom);
      });
      onUpdate(chatRooms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      const allChats = getLocal<ChatRoom[]>("chats", []);
      // Filter chats belonging to this user
      const userChats = allChats.filter(chat => chat.participants.includes(uid));
      onUpdate(userChats);
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_chats", handleStorageChange);
    return () => {
      window.removeEventListener("storage_sync_chats", handleStorageChange);
    };
  }
}

// Start a new chat room
export async function createChat(uid1: string, uid2: string): Promise<string> {
  const chatId = [uid1, uid2].sort().join("_");
  
  if (!isMockFirebase) {
    const path = `chats/${chatId}`;
    try {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          id: chatId,
          participants: [uid1, uid2],
          lastMessage: "Conversation started",
          lastMessageSender: uid1,
          lastMessageTime: new Date().toISOString()
        });
      }
      return chatId;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      return chatId;
    }
  } else {
    const chats = getLocal<ChatRoom[]>("chats", []);
    const existing = chats.find(c => c.id === chatId);
    if (!existing) {
      chats.push({
        id: chatId,
        participants: [uid1, uid2],
        lastMessage: "Chat started",
        lastMessageSender: uid1,
        lastMessageTime: new Date().toISOString()
      });
      setLocal("chats", chats);
    }
    return chatId;
  }
}

// --- REAL-TIME MESSAGES LISTENER ---
export function listenMessages(chatId: string, onUpdate: (messages: Message[]) => void): () => void {
  if (!isMockFirebase) {
    const path = `chats/${chatId}/messages`;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];
      snapshot.forEach((doc) => {
        messages.push(doc.data() as Message);
      });
      onUpdate(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      const allMessages = getLocal<Record<string, Message[]>>("messages", {});
      onUpdate(allMessages[chatId] || []);
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener(`storage_sync_messages_${chatId}`, handleStorageChange);
    return () => {
      window.removeEventListener(`storage_sync_messages_${chatId}`, handleStorageChange);
    };
  }
}

// Send Message
export async function sendMessage(
  chatId: string, 
  senderId: string, 
  text: string, 
  mediaUrl?: string, 
  mediaType?: "image" | "video"
): Promise<void> {
  const timestamp = new Date().toISOString();
  const id = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  
  const newMessage: Message = {
    id,
    senderId,
    text,
    mediaUrl,
    mediaType,
    timestamp,
    status: "sent"
  };

  if (!isMockFirebase) {
    const pathMessage = `chats/${chatId}/messages/${id}`;
    const pathChat = `chats/${chatId}`;
    try {
      // Add message
      await setDoc(doc(db, "chats", chatId, "messages", id), newMessage);
      // Update last message
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: mediaUrl ? (mediaType === "image" ? "🖼️ Image" : "🎥 Video") : text,
        lastMessageSender: senderId,
        lastMessageTime: timestamp
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, pathMessage);
    }
  } else {
    // Save locally
    const allMessages = getLocal<Record<string, Message[]>>("messages", {});
    if (!allMessages[chatId]) allMessages[chatId] = [];
    allMessages[chatId].push(newMessage);
    setLocal("messages", allMessages);
    
    // Dispatch custom event for this specific chat
    window.dispatchEvent(new Event(`storage_sync_messages_${chatId}`));

    // Update Chat Entry
    const chats = getLocal<ChatRoom[]>("chats", []);
    const chatIndex = chats.findIndex(c => c.id === chatId);
    if (chatIndex !== -1) {
      chats[chatIndex].lastMessage = mediaUrl ? (mediaType === "image" ? "🖼️ Image" : "🎥 Video") : text;
      chats[chatIndex].lastMessageSender = senderId;
      chats[chatIndex].lastMessageTime = timestamp;
      setLocal("chats", chats);
    }
  }
}

// Update message status
export function updateMessageStatuses(chatId: string, currentUserId: string) {
  if (!isMockFirebase) {
    // In live firebase we would find unread messages by other and flag as read.
    // Simplifying status write:
  } else {
    const allMessages = getLocal<Record<string, Message[]>>("messages", {});
    const rMessages = allMessages[chatId] || [];
    let updated = false;
    rMessages.forEach(msg => {
      if (msg.senderId !== currentUserId && msg.status !== "read") {
        msg.status = "read";
        updated = true;
      }
    });
    if (updated) {
      allMessages[chatId] = rMessages;
      setLocal("messages", allMessages);
      window.dispatchEvent(new Event(`storage_sync_messages_${chatId}`));
    }
  }
}

// --- STATUS/STORIES OPERATIONS ---
export function listenStatuses(onUpdate: (statuses: StatusStory[]) => void): () => void {
  if (!isMockFirebase) {
    const path = "statuses";
    const q = query(
      collection(db, "statuses"),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      const stories: StatusStory[] = [];
      snapshot.forEach((doc) => {
        stories.push(doc.data() as StatusStory);
      });
      onUpdate(stories);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      onUpdate(getLocal<StatusStory[]>("stories", []));
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_stories", handleStorageChange);
    return () => {
      window.removeEventListener("storage_sync_stories", handleStorageChange);
    };
  }
}

export async function addStatusStory(story: Omit<StatusStory, "id" | "timestamp">) {
  const timestamp = new Date().toISOString();
  const id = "story_" + Date.now();
  const newStory: StatusStory = {
    ...story,
    id,
    timestamp
  };

  if (!isMockFirebase) {
    const path = `statuses/${id}`;
    try {
      await setDoc(doc(db, "statuses", id), newStory);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const stories = getLocal<StatusStory[]>("stories", []);
    stories.unshift(newStory); // prepend
    setLocal("stories", stories);
  }
}

// --- CALL LOGGING & CALL SIGNALING ---
export function listenActiveCalls(uid: string, onUpdate: (calls: CallLog[]) => void): () => void {
  if (!isMockFirebase) {
    const path = "calls";
    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", uid),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      const logs: CallLog[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as CallLog);
      });
      // Only return ringing calls or initiating to trigger phone alert inside iframe
      onUpdate(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      const allCalls = getLocal<CallLog[]>("calls", []);
      // Filter where user is receiver or caller
      const activeUserCalls = allCalls.filter(call => call.receiverId === uid || call.callerId === uid);
      onUpdate(activeUserCalls);
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_calls", handleStorageChange);
    return () => {
      window.removeEventListener("storage_sync_calls", handleStorageChange);
    };
  }
}

export async function initiateCall(
  callerId: string, 
  receiverId: string, 
  callerName: string, 
  receiverName: string, 
  type: "voice" | "video"
): Promise<string> {
  const callId = "call_" + Date.now();
  const newCall: CallLog = {
    id: callId,
    callerId,
    receiverId,
    callerName,
    receiverName,
    type,
    status: "ringing",
    timestamp: new Date().toISOString()
  };

  if (!isMockFirebase) {
    const path = `calls/${callId}`;
    try {
      await setDoc(doc(db, "calls", callId), newCall);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const calls = getLocal<CallLog[]>("calls", []);
    calls.unshift(newCall);
    setLocal("calls", calls);
  }

  return callId;
}

export async function updateCallStatus(callId: string, status: CallLog["status"], duration = 0) {
  if (!isMockFirebase) {
    const path = `calls/${callId}`;
    try {
      await updateDoc(doc(db, "calls", callId), {
        status,
        duration
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const calls = getLocal<CallLog[]>("calls", []);
    const idx = calls.findIndex(c => c.id === callId);
    if (idx !== -1) {
      calls[idx].status = status;
      if (duration > 0) {
        calls[idx].duration = duration;
      }
      setLocal("calls", calls);
    }
  }
}
