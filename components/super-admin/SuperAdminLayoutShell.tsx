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
    <div className="min-h-screen bg-[#F7F2E9] md:grid md:grid-cols-[250px_minmax(0,1fr)]">
      <SuperAdminSidebar
        admin={admin}
        pendingRequestsCount={pendingRequestsCount}
      />
      <main className="mx-auto min-w-0 w-full max-w-7xl p-4 sm:p-5 md:p-8 text-[#24211E]">
        {children}
      </main>
    </div>
  );
}
