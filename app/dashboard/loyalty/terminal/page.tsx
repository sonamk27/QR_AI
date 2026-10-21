import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TerminalPage() {
  // Staff terminal logic is removed — redirect to loyalty & dynamic offers settings
  redirect("/dashboard/loyalty");
}
