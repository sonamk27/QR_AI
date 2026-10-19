import { redirect } from "next/navigation";
import { getOwnerContext } from "@/lib/auth";
import { getOrCreateLoyaltyProgram } from "@/lib/loyalty";
import { StaffTerminalView } from "@/components/loyalty/StaffTerminalView";

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const ctx = await getOwnerContext();
  if (!ctx) redirect("/login");

  const program = await getOrCreateLoyaltyProgram(ctx.restaurant.id);

  return (
    <div className="py-6">
      <StaffTerminalView
        restaurant={{
          id: ctx.restaurant.id,
          name: ctx.restaurant.name,
          brandColor: ctx.restaurant.brandColor,
        }}
        initialPin={program.terminalPin}
      />
    </div>
  );
}
