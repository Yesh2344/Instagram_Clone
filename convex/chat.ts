import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";

// --- Queries ---

export const listUsersForChat = query({
  args: {},
  handler: async (ctx) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      return [];
    }
    const allUsers: Doc<"users">[] = await ctx.runQuery(api.users.list, {});
    return allUsers.filter((user: Doc<"users">) => user._id !== currentUserId);
  },
});

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    const conversations = await ctx.db.query("conversations").collect();
    const userConversations = conversations.filter(conv => conv.participants.includes(userId));

    const conversationsWithDetails = await Promise.all(
      userConversations.map(async (conversation) => {
        const otherParticipantIds = conversation.participants.filter(
          (pId) => pId !== userId
        );
        
        let conversationName = "Chat";
        let conversationImage: string | null | undefined = null;
        let otherParticipantDetails: Doc<"users"> | null = null;

        if (conversation.isGroup && conversation.groupName) {
          conversationName = conversation.groupName;
        } else if (otherParticipantIds.length === 1) {
          const otherUser = await ctx.db.get(otherParticipantIds[0]);
          if (otherUser) {
            conversationName = otherUser.name ?? otherUser.email ?? "Unknown User";
            conversationImage = otherUser.image;
            otherParticipantDetails = otherUser;
          }
        } else if (otherParticipantIds.length > 1) {
          const users = await Promise.all(otherParticipantIds.map(id => ctx.db.get(id)));
          conversationName = users.map(u => u?.name ?? u?.email ?? "Unknown").slice(0,3).join(", ");
          if (users.length > 3) conversationName += "...";
        }

        let lastMessageContent: string | null = null;
        let lastMessageTimestamp: number | null = null;

        if (conversation.lastMessageId) {
          const lastMessage = await ctx.db.get(conversation.lastMessageId);
          if (lastMessage) {
            lastMessageContent = lastMessage.content;
            lastMessageTimestamp = lastMessage._creationTime;
          }
        }
        
        const typingUsers = conversation.typingUserIds ? await Promise.all(
          conversation.typingUserIds
            .filter(typingId => typingId !== userId)
            .map(async (typingId) => {
              const user = await ctx.db.get(typingId);
              return user ? { id: user._id, name: user.name ?? user.email ?? "Someone" } : null;
            })
        ) : [];

        // Get unread count for the current user
        const metadata = await ctx.db
          .query("userConversationMetadata")
          .withIndex("by_user_and_conversation", (q) => 
            q.eq("userId", userId).eq("conversationId", conversation._id)
          )
          .unique();
        const unreadCount = metadata?.unreadCount ?? 0;

        return {
          ...conversation,
          name: conversationName,
          image: conversationImage,
          lastMessageContent,
          lastMessageTimestamp,
          isDirectMessage: !conversation.isGroup && conversation.participants.length === 2,
          otherParticipant: otherParticipantDetails,
          typingUsers: typingUsers.filter(u => u !== null) as { id: Id<"users">; name: string }[],
          unreadCount,
        };
      })
    );
    
    return conversationsWithDetails.sort((a, b) => (b.lastMessageTimestamp ?? 0) - (a.lastMessageTimestamp ?? 0));
  },
});

export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      throw new Error("Conversation not found or user not part of it.");
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return Promise.all(
      messages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          senderName: sender?.name ?? sender?.email ?? "Unknown",
          senderImage: sender?.image,
          isCurrentUser: message.senderId === userId,
        };
      })
    );
  },
});

// --- Mutations ---

export const getOrCreateDMConversation = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("User not authenticated");
    }
    if (currentUserId === args.otherUserId) {
      throw new Error("Cannot start a conversation with yourself");
    }

    const participants = [currentUserId, args.otherUserId].sort(); 

    const allConversations = await ctx.db.query("conversations").collect();
    const foundConversation = allConversations.find(c => 
        !c.isGroup && 
        c.participants.length === 2 && 
        c.participants.every(p => participants.includes(p)) &&
        participants.every(p => c.participants.includes(p))
    );

    if (foundConversation) {
      return foundConversation._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      participants,
      isGroup: false,
      typingUserIds: [],
    });
    // Initialize metadata for both participants
    for (const userId of participants) {
        await ctx.db.insert("userConversationMetadata", {
            userId,
            conversationId,
            unreadCount: 0,
            lastReadTimestamp: Date.now() // Or null, depending on desired initial state
        });
    }
    return conversationId;
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const senderId = await getAuthUserId(ctx);
    if (!senderId) {
      throw new Error("User not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (!conversation.participants.includes(senderId)) {
      throw new Error("User is not part of this conversation");
    }

    if (args.content.trim() === "") {
      throw new Error("Message content cannot be empty");
    }

    const messageId = await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      senderId,
      content: args.content,
      contentType: "text",
    });

    const updatedTypingUserIds = (conversation.typingUserIds || []).filter(id => id !== senderId);
    await ctx.db.patch(args.conversationId, { 
      lastMessageId: messageId,
      typingUserIds: updatedTypingUserIds 
    });

    // Update unread counts for other participants
    for (const participantId of conversation.participants) {
      if (participantId !== senderId) {
        const metadata = await ctx.db
          .query("userConversationMetadata")
          .withIndex("by_user_and_conversation", (q) =>
            q.eq("userId", participantId).eq("conversationId", args.conversationId)
          )
          .unique();

        if (metadata) {
          await ctx.db.patch(metadata._id, {
            unreadCount: (metadata.unreadCount ?? 0) + 1,
          });
        } else {
          // This case should ideally be handled by getOrCreateDMConversation or group creation logic
          await ctx.db.insert("userConversationMetadata", {
            userId: participantId,
            conversationId: args.conversationId,
            unreadCount: 1,
            // lastReadTimestamp can remain null or be set to a very old date
          });
        }
      }
    }
    return messageId;
  },
});

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    typing: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.participants.includes(userId)) throw new Error("User is not part of this conversation");

    let currentTypingIds = conversation.typingUserIds || [];
    if (args.typing) {
      if (!currentTypingIds.includes(userId)) currentTypingIds = [...currentTypingIds, userId];
    } else {
      currentTypingIds = currentTypingIds.filter(id => id !== userId);
    }
    await ctx.db.patch(args.conversationId, { typingUserIds: currentTypingIds });
    return true;
  },
});

export const markConversationAsRead = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            // console.warn("markConversationAsRead called by unauthenticated user.");
            return;
        }

        const metadata = await ctx.db
            .query("userConversationMetadata")
            .withIndex("by_user_and_conversation", (q) => 
                q.eq("userId", userId).eq("conversationId", args.conversationId)
            )
            .unique();

        if (metadata) {
            await ctx.db.patch(metadata._id, {
                unreadCount: 0,
                lastReadTimestamp: Date.now(),
            });
        } else {
            // If no metadata, create it (e.g., for a newly joined user or first interaction)
            await ctx.db.insert("userConversationMetadata", {
                userId,
                conversationId: args.conversationId,
                unreadCount: 0,
                lastReadTimestamp: Date.now(),
            });
        }
    }
});
