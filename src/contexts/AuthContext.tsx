import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  emailVerified: boolean;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOutUser: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setEmailVerified(Boolean(nextUser?.emailVerified));
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<User> => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setUser(cred.user);
    setEmailVerified(Boolean(cred.user.emailVerified));
    return cred.user;
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<User> => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const trimmedName = displayName?.trim();
    if (trimmedName) {
      await updateProfile(cred.user, { displayName: trimmedName.slice(0, 80) });
    }
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Verification mail failure shouldn't block account creation feedback
    }
    setUser(cred.user);
    setEmailVerified(Boolean(cred.user.emailVerified));
    return cred.user;
  };

  const signInWithGoogle = async (): Promise<User> => {
    const cred = await signInWithPopup(auth, googleProvider);
    setUser(cred.user);
    setEmailVerified(Boolean(cred.user.emailVerified));
    return cred.user;
  };

  const signOutUser = async (): Promise<void> => {
    await signOut(auth);
    setUser(null);
    setEmailVerified(false);
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const verified = Boolean(auth.currentUser.emailVerified);
    setUser(auth.currentUser);
    setEmailVerified(verified);
    return verified;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        emailVerified,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOutUser,
        resendVerificationEmail,
        refreshVerificationStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
