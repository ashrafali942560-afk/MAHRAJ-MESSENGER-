export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  phone: string;
  isOnline: boolean;
  lastSeen?: string;
  fcmToken?: string;
  blockedUsers?: string[];
  email?: string;
  username?: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageSender?: string;
  lastMessageTime?: string;
  avatar?: string;
  name?: string;
  typing?: Record<string, boolean>;
}

export interface GroupRoom {
  id: string;
  name: string;
  members: string[];
  creatorId: string;
  avatar: string;
  lastMessage?: string;
  lastMessageSender?: string;
  lastMessageTime?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  fileName?: string;
  fileSize?: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  offlineLocalPath?: string; // e.g. /storage/emulated/0/.../uuid.jpg
  offlineMetadataJSON?: string; // JSON parsed from Gemini or sandbox callback
  sqliteQueryLog?: string; // The simulated SQL transaction triggered log
  simulatedOS?: "Android" | "iOS"; // Simulated mobile device OS
  reactions?: Array<{
    emoji: string;
    userId: string;
    userName: string;
  }>;
}

export interface StatusStory {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  text?: string;
  timestamp: string;
  viewed?: boolean;
  viewers?: Array<{
    userId: string;
    userName: string;
    userAvatar: string;
    timestamp: string;
  }>;
}

export interface CallLog {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  receiverName: string;
  type: "voice" | "video";
  status: "missed" | "completed" | "initiated" | "declined" | "ringing" | "connected";
  timestamp: string;
  duration?: number;
  token?: string;
  channelName?: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  receiverId: string;
  receiverName: string;
  receiverPhotoURL: string;
  status: "pending" | "accepted" | "declined";
  timestamp: string;
}

