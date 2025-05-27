import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const currentLoggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});

// Query to list all users (excluding the current one for chat purposes)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const currentUserId = await getAuthUserId(ctx);
    const users = await ctx.db.query("users").collect();
    // `lastSeen` will be available on user documents
    if (!currentUserId) {
      return users;
    }
    return users.filter((user) => user._id !== currentUserId);
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // console.warn("Heartbeat called by unauthenticated user.");
      return;
    }
    try {
      await ctx.db.patch(userId, { lastSeen: Date.now() });
    } catch (error) {
      console.error(`Failed to update lastSeen for user ${userId}:`, error);
      // It's possible the user document doesn't exist yet if auth setup is slow,
      // or if it's an anonymous user not yet fully in DB.
      // Consider creating/checking user existence if this becomes an issue.
      // For now, we assume the user record from auth is patchable.
    }
  },
});
