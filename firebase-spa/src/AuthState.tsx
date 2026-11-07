import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: "restaurant_admin" | "super_admin";
};

type AuthState = { user: User | null; profile: UserProfile | null; loading: boolean; refreshProfile: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(current: User | null) {
    if (!current) {
      setProfile(null);
      return;
    }
    try {
      const { db } = getFirebaseServices();
      const snap = await getDoc(doc(db, "users", current.uid));
      const data = snap.data();
      if (snap.exists() && (data?.role === "restaurant_admin" || data?.role === "super_admin")) {
        setProfile({ uid: current.uid, email: current.email ?? "", name: data.name ?? "", role: data.role });
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Could not load Firebase user profile", error);
      setProfile(null);
    }
  }

  useEffect(() => {
    let active = true;
    const { auth } = getFirebaseServices();
    return onAuthStateChanged(auth, async (current) => {
      if (!active) return;
      setUser(current);
      await loadProfile(current);
      if (active) setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, profile, loading,
    refreshProfile: () => loadProfile(user),
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuthState must be used within AuthProvider.");
  return state;
}
