import { VerifyEmailView } from "@/components/VerifyEmailView";

export default function VerifyEmailPage({ searchParams }: { searchParams?: { token?: string; email?: string } }) {
  return <VerifyEmailView token={searchParams?.token ?? ""} initialEmail={searchParams?.email ?? ""} />;
}
