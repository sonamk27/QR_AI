import { SuperAdminSidebar } from "./SuperAdminSidebar";

export function SuperAdminLayoutShell({
  admin,
  pendingRequestsCount,
  children,
}: {
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  pendingRequestsCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50/50 md:grid md:grid-cols-[240px_1fr]">
      <SuperAdminSidebar
        admin={admin}
        pendingRequestsCount={pendingRequestsCount}
      />
      <main className="mx-auto w-full max-w-7xl p-5 md:p-8">
        {children}
      </main>
    </div>
  );
}
