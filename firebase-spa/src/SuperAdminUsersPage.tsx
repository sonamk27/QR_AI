import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { UsersAdminTable } from "../../components/UsersAdminTable";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";
import { getBusinessType, type BusinessType } from "../../lib/business-type";

type UserRow = {
  id: string; name: string; email: string; phoneNumber: string | null;
  role: "restaurant_admin" | "super_admin"; createdAt: string;
  restaurants: { id: string; name: string; businessType: BusinessType; city: string | null; status: string }[];
};
function iso(value: any) { return value?.toDate?.().toISOString?.() ?? (typeof value === "string" ? value : new Date(0).toISOString()); }

export default function SuperAdminUsersPage() {
  const { user } = useAuthState();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { db } = getFirebaseServices();
      const [userSnap, restaurantSnap] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "restaurants"))]);
      const restaurantsByOwner = new Map<string, UserRow["restaurants"]>();
      for (const item of restaurantSnap.docs) {
        const data = item.data(); const list = restaurantsByOwner.get(String(data.ownerUid)) ?? [];
        list.push({ id: item.id, name: String(data.name ?? "Business"), businessType: getBusinessType(data.businessType), city: data.city ?? null, status: String(data.status ?? "ACTIVE") });
        restaurantsByOwner.set(String(data.ownerUid), list);
      }
      setRows(userSnap.docs.map((item) => {
        const data = item.data();
        return { id: item.id, name: String(data.name ?? ""), email: String(data.email ?? ""),
          phoneNumber: data.phoneNumber ?? null, role: data.role === "super_admin" ? "super_admin" as const : "restaurant_admin" as const,
          createdAt: iso(data.createdAt), restaurants: restaurantsByOwner.get(item.id) ?? [] };
      }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    } catch (e) { console.error("Super Admin users could not be loaded", e); setError("Could not load users from Firestore. Check your Firestore access rules."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const actions = {
    resetPassword: async (email: string) => { await sendPasswordResetEmail(getFirebaseServices().auth, email); },
    updatePhone: async (id: string, phone: string) => { if (phone.length > 30) throw new Error("Mobile number must be 30 characters or fewer."); await updateDoc(doc(getFirebaseServices().db, "users", id), { phoneNumber: phone || null, updatedAt: serverTimestamp() }); },
    changeRole: async (id: string, role: UserRow["role"]) => { if (id === user?.uid && role !== "super_admin") throw new Error("You cannot remove your own Super Admin access."); await updateDoc(doc(getFirebaseServices().db, "users", id), { role, updatedAt: serverTimestamp() }); },
    onChanged: () => { void load(); },
  };
  const restaurantAdminCount = rows.filter((row) => row.role === "restaurant_admin").length;
  const superAdminCount = rows.filter((row) => row.role === "super_admin").length;
  return <div className="space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-serif text-3xl font-bold tracking-tight text-[#24211E]">User Management</h1><p className="mt-1 text-sm text-[#716B64]">Manage accounts and maintain Super Admin access.</p></div><div className="flex gap-2 text-xs"><div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center"><span className="block text-[#716B64]">Total Users</span><span className="font-bold">{rows.length}</span></div><div className="rounded-xl border border-[#E8DFD1] bg-[#FAF5ED] px-3.5 py-1.5 text-center"><span className="block text-[#B58A4B]">Restaurant Admins</span><span className="font-bold text-[#B58A4B]">{restaurantAdminCount}</span></div><div className="rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-1.5 text-center"><span className="block text-[#716B64]">Super Admins</span><span className="font-bold">{superAdminCount}</span></div></div></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{loading ? <p className="text-sm text-[#716B64]">Loading users…</p> : <UsersAdminTable users={rows} currentAdminId={user?.uid ?? ""} firebaseActions={actions} />}
  </div>;
}
