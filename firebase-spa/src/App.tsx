import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "../../app/page";

const FirebaseAuthForm = lazy(() => import("./FirebaseAuthForm"));
const FirebaseResetPasswordPage = lazy(() => import("./FirebaseResetPasswordPage"));
const AuthGate = lazy(() => import("./AuthGate"));
const ProtectedRoute = lazy(() => import("./ProtectedRoute"));
const DashboardShell = lazy(() => import("./DashboardShell"));
const OwnerDashboardPage = lazy(() => import("./OwnerDashboardPage"));
const ProfileSettingsPage = lazy(() => import("./ProfileSettingsPage"));
const QrRequestsPage = lazy(() => import("./QrRequestsPage"));
const QrManagementPage = lazy(() => import("./QrManagementPage"));
const FeedbackPage = lazy(() => import("./FeedbackPages").then((module) => ({ default: module.FeedbackPage })));
const InsightsPage = lazy(() => import("./FeedbackPages").then((module) => ({ default: module.InsightsPage })));
const DraftsPage = lazy(() => import("./FeedbackPages").then((module) => ({ default: module.DraftsPage })));
const PaymentsPage = lazy(() => import("./PaymentsPage"));
const QrPrintPage = lazy(() => import("./QrPrintPage"));
const PublicQrPage = lazy(() => import("./PublicQrPage"));
const PublicTerminalRedirect = lazy(() => import("./PublicTerminalRedirect"));
const LoyaltyPage = lazy(() => import("./LoyaltyPage"));
const SuperAdminQrRequestsPage = lazy(() => import("./SuperAdminQrRequestsPage"));
const SuperAdminShell = lazy(() => import("./SuperAdminShell"));
const SuperAdminUsersPage = lazy(() => import("./SuperAdminUsersPage"));
const SuperAdminAuditPage = lazy(() => import("./SuperAdminAuditPage"));
const SuperAdminQrCodesPage = lazy(() => import("./SuperAdminQrCodesPage"));
const SuperAdminRestaurantsPage = lazy(() => import("./SuperAdminRestaurantsPage"));
const FirebaseMigrationNotice = lazy(() => import("./FirebaseMigrationNotice"));

function LoadingPage() {
  return <main className="mx-auto max-w-md p-8 text-center text-sm text-[#716B64]">Loading…</main>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<FirebaseAuthForm mode="login" />} />
          <Route path="/admin/login" element={<FirebaseAuthForm mode="login" portal="restaurant_admin" />} />
          <Route path="/signup" element={<FirebaseAuthForm mode="signup" />} />
          <Route path="/reset-password" element={<FirebaseResetPasswordPage />} />
          <Route path="/r/:slug" element={<PublicQrPage />} />
          <Route path="/r/:slug/review" element={<PublicQrPage />} />
          <Route path="/r/:slug/home" element={<PublicQrPage />} />
          <Route path="/r/:slug/loyalty" element={<PublicQrPage />} />
          <Route path="/terminal/:slug" element={<PublicTerminalRedirect />} />
          <Route element={<AuthGate><ProtectedRoute role="restaurant_admin" /></AuthGate>}>
            <Route path="/dashboard" element={<DashboardShell />}>
              <Route index element={<OwnerDashboardPage />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
              <Route path="qr-requests" element={<QrRequestsPage />} />
              <Route path="qr" element={<QrManagementPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="drafts" element={<DraftsPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="loyalty" element={<LoyaltyPage />} />
              <Route path="loyalty/terminal" element={<Navigate to="/dashboard/loyalty" replace />} />
              <Route path="qr/:id/print" element={<QrPrintPage />} />
              <Route path="*" element={<FirebaseMigrationNotice />} />
            </Route>
          </Route>
          <Route element={<AuthGate><ProtectedRoute role="super_admin" /></AuthGate>}>
            <Route path="/super-admin" element={<SuperAdminShell />}>
              <Route index element={<Navigate to="qr-requests" replace />} />
              <Route path="qr-requests" element={<SuperAdminQrRequestsPage />} />
              <Route path="users" element={<SuperAdminUsersPage />} />
              <Route path="qr-codes" element={<SuperAdminQrCodesPage />} />
              <Route path="restaurants" element={<SuperAdminRestaurantsPage />} />
              <Route path="audit" element={<SuperAdminAuditPage />} />
              <Route path="*" element={<FirebaseMigrationNotice />} />
            </Route>
          </Route>
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/superadmin/*" element={<Navigate to="/super-admin" replace />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
