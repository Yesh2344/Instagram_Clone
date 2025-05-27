import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id }  from "./_generated/dataModel";

// Maximum duration for a call to be in "ringing" state before it's considered missed
const RINGING_TIMEOUT_MS = 30 * 1000; // 30 seconds

export const initiateCall = mutation({
  args: {
    calleeId: v.id("users"),
    offer: v.any(), // WebRTC session description offer
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) {
      throw new Error("User not authenticated");
    }
    if (callerId === args.calleeId) {
      throw new Error("Cannot call yourself");
    }

    // Check if callee is already in an active call or has a ringing call
    const existingCallsToCallee = await ctx.db
      .query("calls")
      .withIndex("by_callee_status", (q) => q.eq("calleeId", args.calleeId))
      .filter((q) => q.or(q.eq(q.field("status"), "ringing"), q.eq(q.field("status"), "connected"), q.eq(q.field("status"), "answered")))
      .collect();

    if (existingCallsToCallee.length > 0) {
      // Potentially return the existing call ID or a specific status
      // For now, let's just throw busy
      throw new Error("User is busy or already in a call.");
    }
    
    // Check if caller is already in an active call
    const existingCallsFromCaller = await ctx.db
      .query("calls")
      .withIndex("by_caller_status", (q) => q.eq("callerId", callerId))
      .filter((q) => q.or(q.eq(q.field("status"), "ringing"), q.eq(q.field("status"), "connected"), q.eq(q.field("status"), "answered")))
      .collect();

    if (existingCallsFromCaller.length > 0) {
        throw new Error("You are already in a call.");
    }


    const callId = await ctx.db.insert("calls", {
      callerId,
      calleeId: args.calleeId,
      status: "ringing",
      offer: args.offer,
      callerIceCandidates: [],
      calleeIceCandidates: [],
    });

    // TODO: Consider scheduling a function to mark the call as "missed" if not answered within RINGING_TIMEOUT_MS
    // await ctx.scheduler.runAfter(RINGING_TIMEOUT_MS, internal.calls.markCallAsMissed, { callId });

    return callId;
  },
});

export const answerCall = mutation({
  args: {
    callId: v.id("calls"),
    answer: v.any(), // WebRTC session description answer
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const call = await ctx.db.get(args.callId);
    if (!call) {
      throw new Error("Call not found");
    }
    if (call.calleeId !== userId) {
      throw new Error("Not authorized to answer this call");
    }
    if (call.status !== "ringing") {
      throw new Error(`Call cannot be answered. Status: ${call.status}`);
    }

    await ctx.db.patch(args.callId, {
      status: "answered", // Intermediate status before WebRTC fully connects
      answer: args.answer,
    });
    return true;
  },
});

// Mutation to mark the call as fully connected after ICE exchange and WebRTC setup
export const markCallAsConnected = mutation({
    args: { callId: v.id("calls") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated");

        const call = await ctx.db.get(args.callId);
        if (!call) throw new Error("Call not found");

        // Ensure the user is part of the call
        if (call.callerId !== userId && call.calleeId !== userId) {
            throw new Error("User not part of this call");
        }
        // Only transition from "answered" to "connected"
        if (call.status !== "answered") {
            console.warn(`Call ${args.callId} attempted to connect from status ${call.status}`);
            // Potentially allow if status is ringing and caller is connecting? For now, strict.
            return false; 
        }
        await ctx.db.patch(args.callId, { status: "connected" });
        return true;
    }
});

export const sendIceCandidate = mutation({
  args: {
    callId: v.id("calls"),
    candidate: v.any(),
    role: v.union(v.literal("caller"), v.literal("callee")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const call = await ctx.db.get(args.callId);
    if (!call) {
      throw new Error("Call not found");
    }

    // Validate user is the correct role for sending this candidate
    if (args.role === "caller" && call.callerId !== userId) {
      throw new Error("Not authorized to send caller candidate for this call");
    }
    if (args.role === "callee" && call.calleeId !== userId) {
      throw new Error("Not authorized to send callee candidate for this call");
    }
    
    if (call.status !== "ringing" && call.status !== "answered" && call.status !== "connected") {
        console.warn(`ICE candidate sent for call ${args.callId} with status ${call.status}. Ignoring.`);
        return;
    }

    if (args.role === "caller") {
      const currentCandidates = call.callerIceCandidates || [];
      await ctx.db.patch(args.callId, {
        callerIceCandidates: [...currentCandidates, args.candidate],
      });
    } else { // callee
      const currentCandidates = call.calleeIceCandidates || [];
      await ctx.db.patch(args.callId, {
        calleeIceCandidates: [...currentCandidates, args.candidate],
      });
    }
    return true;
  },
});

export const declineCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User not authenticated");

    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");

    // Caller can cancel a ringing call, Callee can decline a ringing call
    if (call.status !== "ringing") {
      // Allow ending an already answered/connected call via endCall instead
      throw new Error(`Call is not in ringing state. Status: ${call.status}`);
    }
    if (call.calleeId !== userId && call.callerId !== userId) {
      throw new Error("Not authorized to decline/cancel this call");
    }
    
    const reason = call.calleeId === userId ? "declined_by_callee" : "cancelled_by_caller";
    await ctx.db.patch(args.callId, { status: "declined", endedReason: reason });
    return true;
  },
});

export const endCall = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("User not authenticated");

    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");

    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new Error("Not authorized to end this call");
    }

    // Allow ending calls that are ringing, answered, or connected
    if (call.status !== "ringing" && call.status !== "answered" && call.status !== "connected") {
      console.warn(`Attempted to end call ${args.callId} with status ${call.status}. It might have already ended.`);
      // If already ended or declined, do nothing further.
      if (call.status === "ended" || call.status === "declined" || call.status === "missed" || call.status === "failed") {
        return true;
      }
      throw new Error(`Call cannot be ended. Status: ${call.status}`);
    }
    
    const reason = call.callerId === userId ? "ended_by_caller" : "ended_by_callee";
    await ctx.db.patch(args.callId, { status: "ended", endedReason: reason });
    return true;
  },
});


// Query to get details for a specific call, useful for reactive updates on the client
export const getCallDetails = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call) return null;

    // Ensure the user querying is part of the call
    const userId = await getAuthUserId(ctx);
    if (!userId || (call.callerId !== userId && call.calleeId !== userId)) {
        // Or return null if you don't want to expose call existence
        throw new Error("Not authorized to view this call's details."); 
    }
    return call;
  },
});

// Query to find any active call (ringing for callee, or ringing/answered/connected for caller)
export const getMyActiveCall = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        // Check for calls where user is callee and status is ringing
        const incomingCall = await ctx.db
            .query("calls")
            .withIndex("by_callee_status", q => q.eq("calleeId", userId).eq("status", "ringing"))
            .first();
        if (incomingCall) return incomingCall;

        // Check for calls where user is caller or callee and status is answered or connected
        // This needs two queries or a more complex filter if Convex supported OR on different fields in one index query
        const outgoingOrActiveCallAsCaller = await ctx.db
            .query("calls")
            .withIndex("by_caller_status", q => q.eq("callerId", userId))
            .filter(q => q.or(
                q.eq(q.field("status"), "ringing"),
                q.eq(q.field("status"), "answered"),
                q.eq(q.field("status"), "connected")
            ))
            .first();
        if (outgoingOrActiveCallAsCaller) return outgoingOrActiveCallAsCaller;
        
        const activeCallAsCallee = await ctx.db
            .query("calls")
            .withIndex("by_callee_status", q => q.eq("calleeId", userId))
            .filter(q => q.or(
                q.eq(q.field("status"), "answered"),
                q.eq(q.field("status"), "connected")
            ))
            .first();
        if (activeCallAsCallee) return activeCallAsCallee;
        
        return null;
    }
});
