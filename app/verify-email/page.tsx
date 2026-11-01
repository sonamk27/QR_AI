import { VerifyEmailView } from "@/components/VerifyEmailView";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ oobCode?: string; email?: string }> }) {
  const resolvedSearchParams = await searchParams;
  return <VerifyEmailView actionCode={resolvedSearchParams?.oobCode ?? ""} initialEmail={resolvedSearchParams?.email ?? ""} />;
}
