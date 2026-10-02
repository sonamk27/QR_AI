import { getOwnerContext } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const { restaurant } = (await getOwnerContext())!;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Restaurant profile</h1>
      <ProfileForm r={restaurant} />
    </div>
  );
}
