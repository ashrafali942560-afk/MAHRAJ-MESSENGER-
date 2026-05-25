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
  CallLog,
  FriendRequest
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
    displayName: "MAHRAJ HELP",
    photoURL: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=200",
    bio: "Real-time AI Assistant. Ask me anything about this app, general knowledge, or get expert coding help (like WhatsApp Meta AI)!",
    phone: "+44 20 7946 0958",
    email: "help@mahraj.com",
    username: "help",
    isOnline: true
  }
};

// Initial setup helper to populate localStorage with some pretty developer profiles
export function initializeLocalDatabase() {
  const users = getLocal<Record<string, UserProfile>>("users", {});
  if (Object.keys(users).length === 0) {
    setLocal<Record<string, UserProfile>>("users", STARTER_USERS);
    
    // Empty initial status stories/statuses to avoid demo noise
    const initialStories: StatusStory[] = [];
    setLocal<StatusStory[]>("stories", initialStories);

    // Empty initial friend requests to start as a clean, real messaging platform
    const initialFriendRequests: FriendRequest[] = [];
    setLocal<FriendRequest[]>("friend_requests", initialFriendRequests);
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
        lastSeen: new Date().toISOString(),
        blockedUsers: profile.blockedUsers || [],
        email: profile.email || "",
        username: profile.username || ""
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

export async function deleteUserProfile(uid: string): Promise<void> {
  if (!isMockFirebase) {
    const path = `users/${uid}`;
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const users = getLocal<Record<string, UserProfile>>("users", {});
    delete users[uid];
    setLocal("users", users);
    window.dispatchEvent(new Event("storage_sync_users"));
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

// Look up user profiles securely by phone number E.164 query in Firestore or local storage fallback
export async function findUserByPhone(phone: string): Promise<UserProfile | null> {
  const formattedPhone = phone.replace(/[^\d+]/g, ""); // strip non-E.164 formatting characters
  const cleanedQuery = formattedPhone.startsWith("+") 
    ? formattedPhone 
    : formattedPhone.length === 10 
      ? `+91${formattedPhone}` 
      : formattedPhone;

  if (!isMockFirebase) {
    const path = "users";
    try {
      const q = query(collection(db, "users"), where("phone", "==", cleanedQuery));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as UserProfile;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return null;
    }
  } else {
    const users = getLocal<Record<string, UserProfile>>("users", {});
    const match = Object.values(users).find(u => {
      const uPhone = u.phone.replace(/[^\d+]/g, "");
      const uPhoneCleaned = uPhone.startsWith("+") 
        ? uPhone 
        : uPhone.length === 10 
          ? `+91${uPhone}` 
          : uPhone;
      return uPhoneCleaned === cleanedQuery;
    });
    return match || null;
  }
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const cleaned = email.trim().toLowerCase();
  if (!isMockFirebase) {
    const path = "users";
    try {
      const q = query(collection(db, "users"), where("email", "==", cleaned));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as UserProfile;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return null;
    }
  } else {
    const users = getLocal<Record<string, UserProfile>>("users", {});
    const match = Object.values(users).find(u => u.email?.toLowerCase() === cleaned);
    return match || null;
  }
}

export async function findUserByUsername(username: string): Promise<UserProfile | null> {
  const cleaned = username.trim().toLowerCase().replace("@", "");
  if (!cleaned) return null;
  if (!isMockFirebase) {
    const path = "users";
    try {
      const q = query(collection(db, "users"), where("username", "==", cleaned));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as UserProfile;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return null;
    }
  } else {
    const users = getLocal<Record<string, UserProfile>>("users", {});
    const match = Object.values(users).find(u => u.username?.toLowerCase() === cleaned);
    return match || null;
  }
}

export async function findUserByPhoneOrEmail(queryStr: string): Promise<UserProfile | null> {
  const trimmed = queryStr.trim().toLowerCase();
  if (trimmed.includes("@")) {
    return findUserByEmail(trimmed);
  } else {
    return findUserByPhone(trimmed);
  }
}

// --- FRIEND REQUEST SYSTEMS (SECURING CHAT ACCESS BETWEEN USERS) ---
export async function sendFriendRequest(
  senderId: string,
  senderName: string,
  senderPhotoURL: string,
  receiverId: string,
  receiverName: string,
  receiverPhotoURL: string
): Promise<void> {
  const requestId = `${senderId}_${receiverId}`;
  const requestObj: FriendRequest = {
    id: requestId,
    senderId,
    senderName,
    senderPhotoURL: senderPhotoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    receiverId,
    receiverName,
    receiverPhotoURL: receiverPhotoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    status: "pending",
    timestamp: new Date().toISOString()
  };

  if (!isMockFirebase) {
    try {
      await setDoc(doc(db, "friend_requests", requestId), requestObj);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `friend_requests/${requestId}`);
    }
  } else {
    const list = getLocal<FriendRequest[]>("friend_requests", []);
    const filtered = list.filter(r => r.id !== requestId);
    filtered.push(requestObj);
    setLocal("friend_requests", filtered);
  }
}

export function listenFriendRequests(userId: string, onUpdate: (requests: FriendRequest[]) => void): () => void {
  if (!isMockFirebase) {
    const q = query(collection(db, "friend_requests"));
    return onSnapshot(q, (snapshot) => {
      const list: FriendRequest[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as FriendRequest;
        if (d.senderId === userId || d.receiverId === userId) {
          list.push(d);
        }
      });
      onUpdate(list);
    }, (error) => {
      console.warn("Friend request subscription error:", error);
    });
  } else {
    const loadAndEmit = () => {
      const all = getLocal<FriendRequest[]>("friend_requests", []);
      const filtered = all.filter(r => r.senderId === userId || r.receiverId === userId);
      onUpdate(filtered);
    };
    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_friend_requests", handleStorageChange);
    return () => {
      window.removeEventListener("storage_sync_friend_requests", handleStorageChange);
    };
  }
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  if (!isMockFirebase) {
    try {
      const docRef = doc(db, "friend_requests", requestId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const req = snap.data() as FriendRequest;
        await updateDoc(docRef, { status: "accepted" });
        await createChat(req.senderId, req.receiverId);
      }
    } catch (e) {
      console.error("Error accepting friend request:", e);
    }
  } else {
    const list = getLocal<FriendRequest[]>("friend_requests", []);
    const idx = list.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      list[idx].status = "accepted";
      setLocal("friend_requests", list);
      await createChat(list[idx].senderId, list[idx].receiverId);
    }
  }
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  if (!isMockFirebase) {
    try {
      await deleteDoc(doc(db, "friend_requests", requestId));
    } catch (e) {
      console.error("Error declining friend request:", e);
    }
  } else {
    const list = getLocal<FriendRequest[]>("friend_requests", []);
    const filtered = list.filter(r => r.id !== requestId);
    setLocal("friend_requests", filtered);
  }
}


// Synced device contacts persistence helpers
export interface SyncedContact {
  name: string;
  phone: string;
  isRegistered?: boolean;
  profile?: UserProfile;
}

export function getSyncedContactsLocal(): SyncedContact[] {
  return getLocal<SyncedContact[]>("synced_contacts", []);
}

export function saveSyncedContactsLocal(contacts: SyncedContact[]) {
  setLocal<SyncedContact[]>("synced_contacts", contacts);
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
          fileName: data.fileName,
          fileSize: data.fileSize,
          timestamp: data.timestamp,
          status: data.status || "sent",
          offlineLocalPath: data.offlineLocalPath || "",
          offlineMetadataJSON: data.offlineMetadataJSON || "",
          sqliteQueryLog: data.sqliteQueryLog || "",
          simulatedOS: data.simulatedOS || "",
          reactions: data.reactions || []
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
  mediaType?: "image" | "video" | "audio" | "document",
  fileName?: string,
  fileSize?: string,
  offlineLocalPath?: string,
  offlineMetadataJSON?: string,
  sqliteQueryLog?: string,
  simulatedOS?: "Android" | "iOS"
): Promise<void> {
  if (chatId.startsWith("group_")) {
    return sendGroupMessage(chatId, senderId, text, mediaUrl, mediaType, fileName, fileSize);
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
    fileName,
    fileSize,
    timestamp,
    status: "sent",
    offlineLocalPath,
    offlineMetadataJSON,
    sqliteQueryLog,
    simulatedOS
  };

  const getPreviewText = () => {
    if (!mediaUrl) return text;
    if (mediaType === "image") return "🖼️ Image";
    if (mediaType === "video") return "🎥 Video";
    if (mediaType === "audio") return "🎙️ Voice Message";
    if (mediaType === "document") return `📄 ${fileName || "Document"}`;
    return text;
  };

  const previewText = getPreviewText();

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
        fileName: fileName || "",
        fileSize: fileSize || "",
        chatId,
        status: "sent",
        offlineLocalPath: offlineLocalPath || "",
        offlineMetadataJSON: offlineMetadataJSON || "",
        sqliteQueryLog: sqliteQueryLog || "",
        simulatedOS: simulatedOS || ""
      });

      // Update the chat entry for recent conversation preview
      await setDoc(doc(db, "chats", chatId), {
        id: chatId,
        participants: chatId.split("_"),
        lastMessage: previewText,
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
      chats[chatIndex].lastMessage = previewText;
      chats[chatIndex].lastMessageSender = senderId;
      chats[chatIndex].lastMessageTime = timestamp;
      setLocal("chats", chats);
    } else {
      chats.push({
        id: chatId,
        participants: chatId.split("_"),
        lastMessage: previewText,
        lastMessageSender: senderId,
        lastMessageTime: timestamp
      });
      setLocal("chats", chats);
    }
  }
}

// Enrich Message with Offline Native Storage Paths and SQLite Logs
export async function enrichMessageWithOfflineLogs(
  chatId: string,
  messageId: string,
  offlineLocalPath: string,
  offlineMetadataJSON: string,
  sqliteQueryLog: string,
  simulatedOS: "Android" | "iOS"
): Promise<void> {
  if (!isMockFirebase) {
    try {
      // Import updateDoc and doc internally if needed, already present in file scope
      await setDoc(doc(db, "messages", messageId), {
        offlineLocalPath,
        offlineMetadataJSON,
        sqliteQueryLog,
        simulatedOS
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore message enrichment failed, falling back locally:", e);
    }
  }

  // Always update locally for zero-latency instant offline rendering checks
  const allMessages = getLocal<Record<string, Message[]>>("messages", {});
  if (allMessages[chatId]) {
    // Find either by exact ID or if it's the latest media message
    let msgIndex = allMessages[chatId].findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
      // Fallback: search for the last message in this room that has a mediaUrl
      for (let i = allMessages[chatId].length - 1; i >= 0; i--) {
        if (allMessages[chatId][i].mediaUrl) {
          msgIndex = i;
          break;
        }
      }
    }
    
    if (msgIndex !== -1) {
      allMessages[chatId][msgIndex].offlineLocalPath = offlineLocalPath;
      allMessages[chatId][msgIndex].offlineMetadataJSON = offlineMetadataJSON;
      allMessages[chatId][msgIndex].sqliteQueryLog = sqliteQueryLog;
      allMessages[chatId][msgIndex].simulatedOS = simulatedOS;
    }
    
    setLocal("messages", allMessages);
    window.dispatchEvent(new Event(`storage_sync_messages_${chatId}`));
  }
}

// --- GROUP CHAT SPECIFIC OPERATIONS ---

// 1. Create a group in Firestore groups collection
export async function createGroup(name: string, members: string[], creatorId: string, customAvatar?: string): Promise<string> {
  const groupId = "group_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const avatar = customAvatar || `https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&q=80&w=200`; // elegant group avatar default
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

export async function updateGroupMembers(groupId: string, members: string[]): Promise<void> {
  if (!isMockFirebase) {
    const path = `groups/${groupId}`;
    try {
      await updateDoc(doc(db, "groups", groupId), { members });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const groups = getLocal<GroupRoom[]>("groups", []);
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx !== -1) {
      groups[idx].members = members;
      setLocal("groups", groups);
      window.dispatchEvent(new Event("storage_sync_groups"));
    }
  }
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
          fileName: data.fileName,
          fileSize: data.fileSize,
          timestamp: data.timestamp,
          status: data.status || "sent",
          reactions: data.reactions || []
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
  mediaType?: "image" | "video" | "audio" | "document",
  fileName?: string,
  fileSize?: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  const id = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

  const newMessage: Message = {
    id,
    senderId,
    text,
    mediaUrl,
    mediaType,
    fileName,
    fileSize,
    timestamp,
    status: "sent"
  };

  const getPreviewText = () => {
    if (!mediaUrl) return text;
    if (mediaType === "image") return "🖼️ Image";
    if (mediaType === "video") return "🎥 Video";
    if (mediaType === "audio") return "🎙️ Voice Message";
    if (mediaType === "document") return `📄 ${fileName || "Document"}`;
    return text;
  };

  const previewText = getPreviewText();

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
        fileName: fileName || "",
        fileSize: fileSize || "",
        timestamp,
        status: "sent"
      });

      // 2. Update parent document state for reactive preview listing
      await updateDoc(doc(db, "groups", groupId), {
        lastMessage: previewText,
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
      groups[groupIdx].lastMessage = previewText;
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

export async function viewStatusStory(
  storyId: string,
  viewerId: string,
  viewerName: string,
  viewerAvatar: string
): Promise<void> {
  const newViewer = {
    userId: viewerId,
    userName: viewerName,
    userAvatar: viewerAvatar,
    timestamp: new Date().toISOString()
  };

  if (!isMockFirebase) {
    const docRef = doc(db, "statuses", storyId);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as StatusStory;
        const currentViewers = data.viewers || [];
        if (!currentViewers.some((v: any) => v.userId === viewerId)) {
          await updateDoc(docRef, {
            viewers: [...currentViewers, newViewer]
          });
        }
      }
    } catch (e) {
      console.warn("Firestore status view recording failed:", e);
    }
  } else {
    const stories = getLocal<StatusStory[]>("stories", []);
    const idx = stories.findIndex(s => s.id === storyId);
    if (idx !== -1) {
      const currentViewers = stories[idx].viewers || [];
      if (!currentViewers.some(v => v.userId === viewerId)) {
        stories[idx].viewers = [...currentViewers, newViewer];
        setLocal("stories", stories);
        window.dispatchEvent(new Event("storage_sync_stories"));
      }
    }
  }
}

export async function deleteChat(chatId: string) {
  if (!isMockFirebase) {
    const path = `chats/${chatId}`;
    try {
      // 1. Delete the chat room itself
      await deleteDoc(doc(db, "chats", chatId));

      // 2. Query and delete all messages with this chatId
      const q = query(collection(db, "messages"), where("chatId", "==", chatId));
      const snaps = await getDocs(q);
      const batchDeletes: Promise<void>[] = [];
      snaps.forEach((docSnap) => {
        batchDeletes.push(deleteDoc(doc(db, "messages", docSnap.id)));
      });
      await Promise.all(batchDeletes);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    // 1. Delete localized chat room entry
    const chats = getLocal<ChatRoom[]>("chats", []);
    const updated = chats.filter(c => c.id !== chatId);
    setLocal("chats", updated);
    window.dispatchEvent(new Event("storage_sync_chats"));

    // 2. Delete localized messages entry for this chat room
    const allMessages = getLocal<Record<string, Message[]>>("messages", {});
    delete allMessages[chatId];
    setLocal("messages", allMessages);
    window.dispatchEvent(new Event(`storage_sync_messages_${chatId}`));
  }
}

export async function deleteGroup(groupId: string) {
  if (!isMockFirebase) {
    const path = `groups/${groupId}`;
    try {
      await deleteDoc(doc(db, "groups", groupId));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } else {
    const groups = getLocal<GroupRoom[]>("groups", []);
    const updated = groups.filter(g => g.id !== groupId);
    setLocal("groups", updated);
    window.dispatchEvent(new Event("storage_sync_groups"));
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
    window.dispatchEvent(new Event("storage_sync_calls"));
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
    window.dispatchEvent(new Event("storage_sync_calls"));
  }
}

export function listenCall(callId: string, onUpdate: (call: CallLog) => void): () => void {
  if (!isMockFirebase) {
    const path = `calls/${callId}`;
    return onSnapshot(doc(db, "calls", callId), (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as CallLog);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  } else {
    const loadAndEmit = () => {
      const allCalls = getLocal<CallLog[]>("calls", []);
      const call = allCalls.find(c => c.id === callId);
      if (call) {
        onUpdate(call);
      }
    };

    loadAndEmit();
    const handleStorageChange = () => loadAndEmit();
    window.addEventListener("storage_sync_calls", handleStorageChange);
    const interval = setInterval(loadAndEmit, 1000);
    return () => {
      window.removeEventListener("storage_sync_calls", handleStorageChange);
      clearInterval(interval);
    };
  }
}

export async function deleteSingleMessage(chatId: string, messageId: string): Promise<void> {
  const isGroup = chatId.startsWith("group_");
  if (!isMockFirebase) {
    try {
      if (isGroup) {
        await deleteDoc(doc(db, "groups", chatId, "messages", messageId));
      } else {
        await deleteDoc(doc(db, "messages", messageId));
      }
    } catch (e) {
      console.error("Firestore message deletion failed:", e);
    }
  }

  // Always update locally for instant synchronization
  if (isGroup) {
    const allGroupMsgs = getLocal<Record<string, Message[]>>("group_messages", {});
    if (allGroupMsgs[chatId]) {
      allGroupMsgs[chatId] = allGroupMsgs[chatId].filter(m => m.id !== messageId);
      setLocal("group_messages", allGroupMsgs);
      window.dispatchEvent(new Event(`storage_sync_group_messages_${chatId}`));
    }
  } else {
    const allMessages = getLocal<Record<string, Message[]>>("messages", {});
    if (allMessages[chatId]) {
      allMessages[chatId] = allMessages[chatId].filter(m => m.id !== messageId);
      setLocal("messages", allMessages);
      window.dispatchEvent(new Event(`storage_sync_messages_${chatId}`));
    }
  }
}

export async function reactToMessage(
  chatId: string,
  messageId: string,
  emoji: string,
  userId: string,
  userName: string
): Promise<void> {
  const isGroup = chatId.startsWith("group_");
  const newReaction = { emoji, userId, userName };

  if (!isMockFirebase) {
    try {
      const docRef = isGroup 
        ? doc(db, "groups", chatId, "messages", messageId) 
        : doc(db, "messages", messageId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        let reactions: any[] = data.reactions || [];
        // Remove prior reaction by this user to avoid duplication
        reactions = reactions.filter(r => r.userId !== userId);
        reactions.push(newReaction);
        await updateDoc(docRef, { reactions });
      }
    } catch (e) {
      console.warn("Firestore message reaction failed:", e);
    }
  }

  // Update locally for instant synchronization
  if (isGroup) {
    const allGroupMsgs = getLocal<Record<string, Message[]>>("group_messages", {});
    if (allGroupMsgs[chatId]) {
      const idx = allGroupMsgs[chatId].findIndex(m => m.id === messageId);
      if (idx !== -1) {
        let reactions = allGroupMsgs[chatId][idx].reactions || [];
        reactions = reactions.filter(r => r.userId !== userId);
        reactions.push(newReaction);
        allGroupMsgs[chatId][idx].reactions = reactions;
        setLocal("group_messages", allGroupMsgs);
        window.dispatchEvent(new Event(`storage_sync_group_messages_${chatId}`));
      }
    }
  } else {
    const allMessages = getLocal<Record<string, Message[]>>("messages", {});
    if (allMessages[chatId]) {
      const idx = allMessages[chatId].findIndex(m => m.id === messageId);
      if (idx !== -1) {
        let reactions = allMessages[chatId][idx].reactions || [];
        reactions = reactions.filter(r => r.userId !== userId);
        reactions.push(newReaction);
        allMessages[chatId][idx].reactions = reactions;
        setLocal("messages", allMessages);
        window.dispatchEvent(new Event(`storage_sync_messages_${chatId}`));
      }
    }
  }
}
