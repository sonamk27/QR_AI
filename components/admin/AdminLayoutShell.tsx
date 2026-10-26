import { AdminSidebar } from "./AdminSidebar";

export function AdminLayoutShell({
  restaurant,
  user,
  pendingRequestsCount,
  pendingStampRequestsCount,
  children,
}: {
  restaurant: {
    id: string;
    name: string;
    city: string | null;
    brandColor: string;
    status: string;
  };
  user: {
    name: string;
    email: string;
  };
  pendingRequestsCount?: number;
  pendingStampRequestsCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F2E9] text-[#24211E] md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <AdminSidebar
        restaurant={restaurant}
        user={user}
        pendingRequestsCount={pendingRequestsCount}
        pendingStampRequestsCount={pendingStampRequestsCount}
      />
      <main className="mx-auto min-w-0 w-full max-w-6xl p-4 sm:p-5 md:p-8">
        {restaurant.status !== "ACTIVE" && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">⚠️ Account Notice:</span>
              <span>
                This restaurant profile is pending activation. Please review program configuration or contact support.
              </span>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
