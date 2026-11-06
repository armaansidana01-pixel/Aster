import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on initial boot per Firebase Integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Blueprint validation constants synced verbatim from firebase-blueprint.json
export const WORKSPACE_CONSTRAINTS = {
  OWNER_ID_MAX_LEN: 128,
  OWNER_ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  DISPLAY_NAME_MIN_LEN: 1,
  DISPLAY_NAME_MAX_LEN: 80,
  TARGET_SCORE_MIN: 400,
  TARGET_SCORE_MAX: 1600,
  STUDY_GOAL_MAX_LEN: 64,
  PAYLOAD_JSON_MAX_LEN: 400000,
};

export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<{ user: User; verificationSent: boolean }> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  let verificationSent = false;
  try {
    await sendEmailVerification(cred.user);
    verificationSent = true;
  } catch (err) {
    console.warn('Verification email warning:', err);
  }
  return { user: cred.user, verificationSent };
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) throw new Error('No user signed in.');
  await sendEmailVerification(auth.currentUser);
}

export async function triggerPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };

export async function saveWorkspaceToFirestore(
  user: User,
  displayName: string,
  targetScore: number,
  studyGoal: string,
  theme: 'dark' | 'light',
  workspaceSnapshot: unknown
): Promise<void> {
  if (!user.emailVerified) {
    // Firestore rules require verified email for writes
    return;
  }
  const uid = user.uid.slice(0, WORKSPACE_CONSTRAINTS.OWNER_ID_MAX_LEN);
  if (!WORKSPACE_CONSTRAINTS.OWNER_ID_PATTERN.test(uid)) {
    return;
  }

  const safeName = (displayName || 'Student')
    .trim()
    .slice(0, WORKSPACE_CONSTRAINTS.DISPLAY_NAME_MAX_LEN) || 'Student';
  const safeTarget = Math.max(
    WORKSPACE_CONSTRAINTS.TARGET_SCORE_MIN,
    Math.min(WORKSPACE_CONSTRAINTS.TARGET_SCORE_MAX, Math.round(targetScore || 1500))
  );
  const safeGoal = (studyGoal || 'balanced_1500').slice(
    0,
    WORKSPACE_CONSTRAINTS.STUDY_GOAL_MAX_LEN
  );
  const safeTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const serialized = JSON.stringify(workspaceSnapshot).slice(
    0,
    WORKSPACE_CONSTRAINTS.PAYLOAD_JSON_MAX_LEN
  );

  const path = `workspaces/${uid}`;
  const docRef = doc(db, 'workspaces', uid);

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        ownerId: uid,
        displayName: safeName,
        targetScore: safeTarget,
        studyGoal: safeGoal,
        theme: safeTheme,
        payloadJson: serialized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      await setDoc(docRef, {
        ownerId: existingData.ownerId,
        displayName: safeName,
        targetScore: safeTarget,
        studyGoal: safeGoal,
        theme: safeTheme,
        payloadJson: serialized,
        createdAt: existingData.createdAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadWorkspaceFromFirestore(
  user: User
): Promise<Record<string, unknown> | null> {
  const uid = user.uid;
  const path = `workspaces/${uid}`;
  const docRef = doc(db, 'workspaces', uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (typeof data.payloadJson === 'string') {
      return JSON.parse(data.payloadJson);
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteUserAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user currently signed in.');
  const uid = user.uid;
  try {
    const docRef = doc(db, 'workspaces', uid);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Could not delete workspace document from Firestore:', err);
  }
  try {
    await deleteUser(user);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${uid}`);
  }
}

