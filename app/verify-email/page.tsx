import { VerifyEmailView } from "@/components/VerifyEmailView";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  const resolvedSearchParams = await searchParams;
  return <VerifyEmailView token={resolvedSearchParams?.token ?? ""} initialEmail={resolvedSearchParams?.email ?? ""} />;
}
