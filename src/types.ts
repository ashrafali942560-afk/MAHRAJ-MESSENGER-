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
}

export interface StatusStory {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl?: string;
  text?: string;
  timestamp: string;
  viewed?: boolean;
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
