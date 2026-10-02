import { AdminSidebar } from "./AdminSidebar";

export function AdminLayoutShell({
  restaurant,
  user,
  pendingRequestsCount,
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
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[230px_1fr]">
      <AdminSidebar
        restaurant={restaurant}
        user={user}
        pendingRequestsCount={pendingRequestsCount}
      />
      <main className="mx-auto w-full max-w-5xl p-5 md:p-8">
        {restaurant.status !== "ACTIVE" && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">⚠️ Account Suspended:</span>
              <span>
                This restaurant profile is temporarily suspended. Customers scanning your QR codes will be notified. Please contact platform support.
              </span>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
