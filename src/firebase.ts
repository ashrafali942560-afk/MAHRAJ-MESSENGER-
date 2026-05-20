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
export const isMockFirebase = firebaseConfig.apiKey.includes("_MOCK_") || firebaseConfig.projectId === "mahraj-messenger";

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

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
