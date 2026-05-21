import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, User as FirebaseUser } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  collection, 
  getDocFromServer,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import firebaseConfig from "../firebase-applet-config.json";

// Standard Operation Type enum and error info interface as mandated in skill docs
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

// Check if we are using the mock config or the real cloud project
export const isMockFirebase = firebaseConfig.apiKey.includes("_MOCK_");

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

// Safe Messaging Initialization to handle sandboxed iframe or push API blocks elegantly
let messagingInstance: Messaging | null = null;
try {
  messagingInstance = getMessaging(app);
} catch (e) {
  console.warn("Firebase Messaging service load skipped or not supported in this frame environment.", e);
}

export const messaging = messagingInstance;

// Helper to register Web Push registration token
export async function getWebPushToken(): Promise<string | null> {
  if (isMockFirebase || !messaging) {
    // Elegant simulated token with the target VAPID signature suffix for offline/mock operations
    return "fcm_mock_token_BCDVwQCFfbWdqCjr_v1_" + Math.random().toString(36).substring(2, 10);
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: "BCDVwQCFfbWdqCjrwpVJb7fMN5K-CQ0gOVL3NyA0wuohuCR-iT7naVXLjfugMYa9U971G2S8d5OXHCSKcl2gwcQ"
      });
      return token;
    } else {
      console.warn("Notification permission was not granted by client.");
    }
  } catch (err) {
    console.error("FCM Token Extraction Error: ", err);
  }
  return null;
}

// Mandated handleFirestoreError function
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Verify database connection at startup as mandated
export async function testConnection() {
  if (isMockFirebase) {
    console.log("[MAHRAJ Offline Mode] Using high-fidelity browser state engine.");
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("[MAHRAJ Firebase Code] Cloud database connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client appears offline or blocked in iframe. Please verify Firebase project secrets.");
    }
  }
}

testConnection();
