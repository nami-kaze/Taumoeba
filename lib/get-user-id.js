import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

/**
 * Resolve the current Clerk-authenticated user to their database user id.
 * Throws if the request is unauthenticated or the user has no DB record.
 */
export async function getUserId() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user.id; // Return the database user ID, not the Clerk user ID
}
