import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// --- Queries ---

export const getGlobalFeed = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db.query("images").order("desc").collect();
    const imagesWithDetails = await Promise.all(
      images.map(async (image) => {
        const user = await ctx.db.get(image.userId);
        const url = await ctx.storage.getUrl(image.storageId);
        if (!user || !url) {
          // Skip if user or URL is not found, or handle error appropriately
          return null;
        }
        return {
          ...image,
          uploaderName: user.name ?? user.email ?? "Anonymous",
          uploaderImage: user.image,
          url,
          isLikedByCurrentUser: false, // Placeholder, will be updated if user is logged in
        };
      })
    );

    const loggedInUserId = await getAuthUserId(ctx);
    if (loggedInUserId) {
      return imagesWithDetails
        .filter((img) => img !== null)
        .map((image) => ({
          ...image!,
          isLikedByCurrentUser: image!.likes.includes(loggedInUserId),
        }));
    }

    return imagesWithDetails.filter((img) => img !== null);
  },
});

export const getUserImages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return []; // Or throw an error: "User not authenticated"
    }

    const images = await ctx.db
      .query("images")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      images.map(async (image) => {
        const url = await ctx.storage.getUrl(image.storageId);
        if (!url) return { ...image, url: null, isLikedByCurrentUser: false }; // Handle missing URL
        return {
          ...image,
          url,
          isLikedByCurrentUser: image.likes.includes(userId),
        };
      })
    );
  },
});

// --- Mutations ---

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const createImage = mutation({
  args: {
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    await ctx.db.insert("images", {
      userId,
      storageId: args.storageId,
      likes: [],
      caption: args.caption,
    });
  },
});

export const deleteImage = mutation({
  args: { imageId: v.id("images"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.userId !== userId) {
      throw new Error("User not authorized to delete this image");
    }

    await ctx.db.delete(args.imageId);
    await ctx.storage.delete(args.storageId); // Delete from file storage
  },
});

export const likeImage = mutation({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (!image.likes.includes(userId)) {
      await ctx.db.patch(args.imageId, {
        likes: [...image.likes, userId],
      });
    }
  },
});

export const unlikeImage = mutation({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.likes.includes(userId)) {
      await ctx.db.patch(args.imageId, {
        likes: image.likes.filter((id) => id !== userId),
      });
    }
  },
});
