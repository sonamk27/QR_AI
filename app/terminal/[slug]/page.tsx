import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TerminalPublicPage({ params }: { params: { slug: string } }) {
  // Staff terminal logic is removed — redirect to customer offers & rewards card
  redirect(`/r/${params.slug}/loyalty`);
}
