import { db } from "@/lib/db";

async function main() {
  try {
    const user = await db.user.findFirst();
    console.log("DB SUCCESS! Found user:", user ? user.email : "No users in DB");
  } catch (err: any) {
    console.error("DB FAILED Error Code:", err?.code);
    console.error("DB FAILED Message:", err?.message);
  } finally {
    await db.$disconnect();
  }
}

main();
