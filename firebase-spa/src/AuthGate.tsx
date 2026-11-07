import type { ReactNode } from "react";
import { AuthProvider } from "./AuthState";

export default function AuthGate({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
