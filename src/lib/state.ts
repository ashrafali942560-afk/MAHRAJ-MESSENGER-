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
  GroupRoom,
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
  deleteDoc,
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

export function listenAllUsers(onUpdate: (users: UserProfile[]) => void): () => void {
  if (!isMockFirebase) {
    const path = "users";
    const q = query(collection(db, "users"));
    return onSnapshot(q, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      onUpdate(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      onUpdate(getAllUsersLocal());
    };
    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_users", handleStorageChange);
    return () => {
      window.removeEventListener("storage_sync_users", handleStorageChange);
    };
  }
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
  if (chatId.startsWith("group_")) {
    return listenGroupMessages(chatId, onUpdate);
  }
  if (!isMockFirebase) {
    const path = "messages";
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );
    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Fallback text to messageText if text is missing, handle timestamp formats
        messages.push({
          id: data.id || doc.id,
          senderId: data.senderId,
          text: data.text || data.messageText || "",
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType || data.messageType,
          timestamp: data.timestamp,
          status: data.status || "sent"
        });
      });
      // Sort client-side securely to bypass composite index constraints
      messages.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
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

// Send Message (One-to-One Chat)
export async function sendMessage(
  chatId: string, 
  senderId: string, 
  text: string, 
  mediaUrl?: string, 
  mediaType?: "image" | "video"
): Promise<void> {
  if (chatId.startsWith("group_")) {
    return sendGroupMessage(chatId, senderId, text, mediaUrl, mediaType);
  }
  const timestamp = new Date().toISOString();
  const id = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const receiverId = chatId.split("_").find(uid => uid !== senderId) || "";

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
    const pathMessage = `messages/${id}`;
    const pathChat = `chats/${chatId}`;
    try {
      // Store inside the root messages collection as requested
      await setDoc(doc(db, "messages", id), {
        id,
        senderId,
        receiverId,
        messageText: text,
        text, // keep for UI compatibility
        timestamp,
        messageType: mediaUrl ? (mediaType || "image") : "text",
        mediaType: mediaUrl ? (mediaType || "image") : "text", // keep for UI compatibility
        mediaUrl: mediaUrl || "",
        chatId,
        status: "sent"
      });

      // Update the chat entry for recent conversation preview
      await setDoc(doc(db, "chats", chatId), {
        id: chatId,
        participants: chatId.split("_"),
        lastMessage: mediaUrl ? (mediaType === "image" ? "🖼️ Image" : "🎥 Video") : text,
        lastMessageSender: senderId,
        lastMessageTime: timestamp
      }, { merge: true });

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
    } else {
      chats.push({
        id: chatId,
        participants: chatId.split("_"),
        lastMessage: mediaUrl ? (mediaType === "image" ? "🖼️ Image" : "🎥 Video") : text,
        lastMessageSender: senderId,
        lastMessageTime: timestamp
      });
      setLocal("chats", chats);
    }
  }
}

// --- GROUP CHAT SPECIFIC OPERATIONS ---

// 1. Create a group in Firestore groups collection
export async function createGroup(name: string, members: string[], creatorId: string): Promise<string> {
  const groupId = "group_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const avatar = `https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&q=80&w=200`; // elegant group avatar
  const timestamp = new Date().toISOString();

  const newGroup: GroupRoom = {
    id: groupId,
    name,
    members,
    creatorId,
    avatar,
    lastMessage: `${name} group created`,
    lastMessageSender: creatorId,
    lastMessageTime: timestamp
  };

  if (!isMockFirebase) {
    const path = `groups/${groupId}`;
    try {
      await setDoc(doc(db, "groups", groupId), newGroup);
      
      // Seed a starter system message in subcollection matching instructions
      const systemMsgId = "msg_seed_" + Date.now();
      await setDoc(doc(db, "groups", groupId, "messages", systemMsgId), {
        id: systemMsgId,
        senderId: "system",
        text: `Welcome to ${name}! Secure messaging session started.`,
        messageText: `Welcome to ${name}! Secure messaging session started.`,
        timestamp,
        messageType: "text",
        status: "sent"
      });
      
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const groups = getLocal<GroupRoom[]>("groups", []);
    groups.push(newGroup);
    setLocal("groups", groups);

    // Seed a starter local message
    const allGroupMsgs = getLocal<Record<string, Message[]>>("group_messages", {});
    allGroupMsgs[groupId] = [{
      id: "msg_seed_" + Date.now(),
      senderId: "system",
      text: `Welcome to ${name}! Secure messaging session started.`,
      timestamp,
      status: "sent"
    }];
    setLocal("group_messages", allGroupMsgs);
  }

  return groupId;
}

// 2. Listen to active groups for current user
export function listenGroups(uid: string, onUpdate: (groups: GroupRoom[]) => void): () => void {
  if (!isMockFirebase) {
    const path = "groups";
    const q = query(
      collection(db, "groups"),
      where("members", "array-contains", uid)
    );
    return onSnapshot(q, (snapshot) => {
      const groupRooms: GroupRoom[] = [];
      snapshot.forEach((doc) => {
        groupRooms.push(doc.data() as GroupRoom);
      });
      onUpdate(groupRooms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      const allGroups = getLocal<GroupRoom[]>("groups", []);
      const userGroups = allGroups.filter(g => g.members.includes(uid));
      onUpdate(userGroups);
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_groups", handleStorageChange);
    return () => {
      window.removeEventListener("storage_sync_groups", handleStorageChange);
    };
  }
}

// 3. Listen to messages inside a specific group (subcollection list)
export function listenGroupMessages(groupId: string, onUpdate: (messages: Message[]) => void): () => void {
  if (!isMockFirebase) {
    const path = `groups/${groupId}/messages`;
    // We listen to the subcollection
    const q = query(
      collection(db, "groups", groupId, "messages")
    );
    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: data.id || doc.id,
          senderId: data.senderId,
          text: data.text || data.messageText || "",
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType || data.messageType,
          timestamp: data.timestamp,
          status: data.status || "sent"
        });
      });
      // Client-side sort safely to prevent composite indices requirement
      messages.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });
      onUpdate(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      const allGroupMsgs = getLocal<Record<string, Message[]>>("group_messages", {});
      onUpdate(allGroupMsgs[groupId] || []);
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener(`storage_sync_group_messages_${groupId}`, handleStorageChange);
    return () => {
      window.removeEventListener(`storage_sync_group_messages_${groupId}`, handleStorageChange);
    };
  }
}

// 4. Send Message inside group’s sub-collection
export async function sendGroupMessage(
  groupId: string,
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
    const pathMessage = `groups/${groupId}/messages/${id}`;
    try {
      // 1. Save directly into sub-collection groups/{groupId}/messages
      await setDoc(doc(db, "groups", groupId, "messages", id), {
        id,
        senderId,
        text,
        messageText: text,
        mediaUrl: mediaUrl || "",
        mediaType: mediaUrl ? (mediaType || "image") : "text",
        messageType: mediaUrl ? (mediaType || "image") : "text",
        timestamp,
        status: "sent"
      });

      // 2. Update parent document state for reactive preview listing
      await updateDoc(doc(db, "groups", groupId), {
        lastMessage: mediaUrl ? (mediaType === "image" ? "🖼️ Image" : "🎥 Video") : text,
        lastMessageSender: senderId,
        lastMessageTime: timestamp
      });

    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, pathMessage);
    }
  } else {
    const allGroupMsgs = getLocal<Record<string, Message[]>>("group_messages", {});
    if (!allGroupMsgs[groupId]) allGroupMsgs[groupId] = [];
    allGroupMsgs[groupId].push(newMessage);
    setLocal("group_messages", allGroupMsgs);

    window.dispatchEvent(new Event(`storage_sync_group_messages_${groupId}`));

    const groups = getLocal<GroupRoom[]>("groups", []);
    const groupIdx = groups.findIndex(g => g.id === groupId);
    if (groupIdx !== -1) {
      groups[groupIdx].lastMessage = mediaUrl ? (mediaType === "image" ? "🖼️ Image" : "🎥 Video") : text;
      groups[groupIdx].lastMessageSender = senderId;
      groups[groupIdx].lastMessageTime = timestamp;
      setLocal("groups", groups);
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
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  if (!isMockFirebase) {
    const path = "statuses";
    const q = query(
      collection(db, "statuses"),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      const stories: StatusStory[] = [];
      snapshot.forEach((snapshotDoc) => {
        const item = snapshotDoc.data() as StatusStory;
        const storyTime = new Date(item.timestamp).getTime();
        if (storyTime < cutoff) {
          // Asynchronously delete from Firebase DB as it is older than 24 hours
          deleteDoc(doc(db, "statuses", item.id)).catch(err => {
            console.warn("Auto-purged status clean error:", err);
          });
        } else {
          stories.push(item);
        }
      });
      onUpdate(stories);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } else {
    const loadAndEmit = () => {
      const allStories = getLocal<StatusStory[]>("stories", []);
      const activeStories = allStories.filter(story => {
        return new Date(story.timestamp).getTime() >= cutoff;
      });
      if (activeStories.length !== allStories.length) {
        setLocal("stories", activeStories);
      }
      onUpdate(activeStories);
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
    window.dispatchEvent(new Event("storage_sync_stories"));
  }
}

export async function deleteStatusStory(storyId: string) {
  if (!isMockFirebase) {
    const path = `statuses/${storyId}`;
    try {
      await deleteDoc(doc(db, "statuses", storyId));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const stories = getLocal<StatusStory[]>("stories", []);
    const updated = stories.filter(s => s.id !== storyId);
    setLocal("stories", updated);
    window.dispatchEvent(new Event("storage_sync_stories"));
  }
}

// --- CALL LOGGING & CALL SIGNALING ---
export function listenActiveCalls(uid: string, onUpdate: (calls: CallLog[]) => void): () => void {
  if (!isMockFirebase) {
    const path = "calls";
    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", uid)
    );
    return onSnapshot(q, (snapshot) => {
      const logs: CallLog[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as CallLog);
      });
      // Sort client-side by timestamp descending to avoid requiring composite indexes
      logs.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
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
    timestamp: new Date().toISOString(),
    token: "AdpetEZWPu5ZTOu14nuvcxKGzKKDsnb7fenZQXfRyAQP5n0laEzyX9qN01aADH6El1Nm7EY8cRQppHYGe_aKMVUp_3pYUI3G1bLWXnLfwVIJgNC_h8drfqmMTz7bpWHYwmVpSmIOCsbwiNbGQ4J8ttgMJw",
    channelName: `agora_${callId}`
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
