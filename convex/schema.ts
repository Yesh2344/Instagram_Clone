import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const usersTableWithLastSeen = defineTable({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  lastSeen: v.optional(v.number()),
})
  .index("email", ["email"])
  .index("phone", ["phone"]);

const applicationTables = {
  images: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    likes: v.array(v.id("users")),
    caption: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_storageId", ["storageId"]),

  conversations: defineTable({
    participants: v.array(v.id("users")),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
    lastMessageId: v.optional(v.id("chatMessages")),
    typingUserIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_participants", ["participants"])
    .index("by_lastMessage", ["lastMessageId"]),

  chatMessages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    contentType: v.optional(v.union(v.literal("text"), v.literal("image"), v.literal("file"))),
  })
    .index("by_conversationId", ["conversationId"]),

  userConversationMetadata: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    lastReadTimestamp: v.optional(v.number()),
    unreadCount: v.optional(v.number()),
  })
    .index("by_user_and_conversation", ["userId", "conversationId"])
    .index("by_conversation_and_user", ["conversationId", "userId"]),

  calls: defineTable({
    callerId: v.id("users"),
    calleeId: v.id("users"),
    status: v.union(
      v.literal("ringing"),
      v.literal("answered"), // Renamed from "connected" for clarity during signaling
      v.literal("connected"), // Actual WebRTC connection established
      v.literal("declined"),
      v.literal("ended"),
      v.literal("busy"), // If callee is already in another call
      v.literal("failed"), // If something went wrong (e.g., WebRTC error)
      v.literal("missed") // If ringing timed out
    ),
    // WebRTC signaling data - v.any() is used for simplicity, can be more specific
    offer: v.optional(v.any()),
    answer: v.optional(v.any()),
    // Storing candidates in arrays; might need a separate table for many candidates
    callerIceCandidates: v.optional(v.array(v.any())),
    calleeIceCandidates: v.optional(v.array(v.any())),
    endedReason: v.optional(v.string()), // e.g., "declined_by_user", "ended_by_caller"
  })
    .index("by_callee_status", ["calleeId", "status"]) // To find ringing calls for a user
    .index("by_caller_status", ["callerId", "status"]), // To find calls initiated by a user
};

export default defineSchema({
  ...authTables,
  users: usersTableWithLastSeen,
  ...applicationTables,
});
