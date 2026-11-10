import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuthState } from "./AuthState";

export default function ProtectedRoute({ role }: { role: "restaurant_admin" | "super_admin" }) {
  const { user, profile, loading } = useAuthState();
  if (loading) return <main className="mx-auto max-w-md p-8 text-center text-sm text-[#716B64]">Loading your account…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <main className="mx-auto max-w-lg p-8 text-center"><h1 className="font-serif text-2xl font-bold">Verify your email</h1><p className="mt-3 text-sm text-[#716B64]">Check your inbox and verify your email address before accessing your account.</p><Link to="/login" className="mt-4 inline-block text-sm font-semibold text-[#7A5826] underline">Return to sign in</Link></main>;
  if (!profile) return <main className="mx-auto max-w-lg p-8 text-center"><h1 className="font-serif text-2xl font-bold">Account setup needed</h1><p className="mt-3 text-sm text-[#716B64]">Your Firebase sign-in works, but a ReviewFlow profile has not been linked to this account.</p></main>;
  if (profile.role !== role) return <Navigate to={profile.role === "super_admin" ? "/super-admin" : "/dashboard"} replace />;
  return <Outlet />;
}
