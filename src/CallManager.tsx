import { useEffect, useState, useRef, useCallback, PropsWithChildren } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id, Doc } from '../convex/_generated/dataModel';
import { toast } from 'sonner';
import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming, PhoneCallIcon as AcceptCallIcon, AlertTriangle } from 'lucide-react';
import { CallContext } from './CallContext';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
type CallDoc = Doc<"calls">;

export default function CallManager({ children }: PropsWithChildren<{}>) {
  const myActiveCallQuery = useQuery(api.calls.getMyActiveCall);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  
  const callDetails = useQuery(
    api.calls.getCallDetails,
    myActiveCallQuery?._id ? { callId: myActiveCallQuery._id } : "skip"
  );

  const initiateCallMutation = useMutation(api.calls.initiateCall);
  const answerCallMutation = useMutation(api.calls.answerCall);
  const declineCallMutation = useMutation(api.calls.declineCall);
  const endCallMutation = useMutation(api.calls.endCall);
  const sendIceCandidateMutation = useMutation(api.calls.sendIceCandidate);
  const markCallAsConnectedMutation = useMutation(api.calls.markCallAsConnected);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [isUiVisible, setIsUiVisible] = useState(false);
  const [callStatusForUI, setCallStatusForUI] = useState<CallDoc["status"] | null>(null);
  
  const pendingIceCandidatesRef = useRef<{ role: 'caller' | 'callee', candidates: RTCIceCandidateInit[] }>({ role: 'caller', candidates: [] });
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const cleanupWebRTC = useCallback((endedCallId?: Id<"calls">) => {
    console.log("Cleaning up WebRTC resources for call:", endedCallId);
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setRemoteStream(null);
    pendingIceCandidatesRef.current = { role: 'caller', candidates: [] };
    setCallError(null);
    setIsUiVisible(false);
    setCallStatusForUI(null);
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  const createPeerConnection = useCallback(() => {
    if (!loggedInUser ) { 
        console.warn("Cannot create peer connection: missing user");
        return null;
    }
    // We need callDetails._id for ICE candidate mutation, but it might not be available when PC is first created by caller
    // So, callDetails._id check is removed here, but mutations using it must ensure it exists.
    console.log("Creating PeerConnection");
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = event => {
      // Ensure callDetails and its _id are available before sending candidate
      const currentCallId = callDetails?._id || myActiveCallQuery?._id;
      if (event.candidate && currentCallId && loggedInUser) {
        const role = (callDetails?.callerId || myActiveCallQuery?.callerId) === loggedInUser._id ? "caller" : "callee";
        console.log(`Sending ${role} ICE candidate for call ${currentCallId}:`, event.candidate);
        sendIceCandidateMutation({
          callId: currentCallId,
          candidate: event.candidate.toJSON(),
          role: role,
        }).catch(err => console.error("Error sending ICE candidate:", err));
      }
    };

    pc.ontrack = event => {
      console.log("Remote track received:", event.streams[0]);
      setRemoteStream(event.streams[0]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      const currentCallDoc = callDetails || myActiveCallQuery;
      if (!pcRef.current || !currentCallDoc) return;
      console.log("PeerConnection state:", pcRef.current.connectionState, "for call:", currentCallDoc._id);
      if (pcRef.current.connectionState === 'connected') {
        if (currentCallDoc.status === "answered" || (currentCallDoc.status === "ringing" && currentCallDoc.callerId === loggedInUser?._id)) { 
             markCallAsConnectedMutation({ callId: currentCallDoc._id })
            .then(() => setCallStatusForUI("connected"))
            .catch(err => console.error("Error marking call as connected:", err));
        }
      } else if (['failed', 'disconnected', 'closed'].includes(pcRef.current.connectionState)) {
        setCallError(`Call ${pcRef.current.connectionState}.`);
        if (currentCallDoc.status !== "ended" && currentCallDoc.status !== "declined" && currentCallDoc.status !== "missed") {
          endCallMutation({callId: currentCallDoc._id}).catch(err => console.error("Error auto-ending call:", err));
        }
      }
    };
    return pc;
  }, [loggedInUser, callDetails, myActiveCallQuery, sendIceCandidateMutation, markCallAsConnectedMutation, endCallMutation]);
  
  const startLocalMediaAndTracks = useCallback(async (pc: RTCPeerConnection) => {
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
            try {
                if(pc.signalingState !== "closed") pc.addTrack(track, localStreamRef.current!);
            } catch (e) { console.error("Error adding existing track:", e); }
        });
        return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => {
        if(pc.signalingState !== "closed") pc.addTrack(track, stream);
      });
      return true;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      setCallError("Microphone access denied or unavailable.");
      toast.error("Microphone access denied.");
      const currentCallId = callDetails?._id || myActiveCallQuery?._id;
      if (currentCallId) endCallMutation({callId: currentCallId});
      return false;
    }
  }, [callDetails, myActiveCallQuery, endCallMutation]);

  useEffect(() => {
    const currentCallDoc = callDetails || myActiveCallQuery;
    if (pcRef.current && pcRef.current.remoteDescription && pendingIceCandidatesRef.current.candidates.length > 0) {
      const roleForCandidates = pendingIceCandidatesRef.current.role;
      const candidates = pendingIceCandidatesRef.current.candidates;
      console.log(`Processing ${candidates.length} pending ${roleForCandidates} ICE candidates.`);
      
      candidates.forEach(candidate => {
        if(pcRef.current && pcRef.current.signalingState !== "closed") {
            pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.error(`Error adding pending ${roleForCandidates} ICE candidate:`, err, candidate));
        }
      });
      pendingIceCandidatesRef.current.candidates = [];
    }
  }, [pcRef.current?.remoteDescription, callDetails, myActiveCallQuery]);


  useEffect(() => {
    const currentCallDoc = callDetails || myActiveCallQuery; // Prefer callDetails if available
    if (!currentCallDoc || !loggedInUser) {
      if (isUiVisible) cleanupWebRTC(currentCallDoc?._id);
      return;
    }
    
    setCallStatusForUI(currentCallDoc.status);
    setIsUiVisible(true);

    let pc = pcRef.current;
    if (!pc && (currentCallDoc.status === "ringing" || currentCallDoc.status === "answered" || (currentCallDoc.callerId === loggedInUser._id && !currentCallDoc.offer))) {
        pc = createPeerConnection(); // createPeerConnection now uses callDetails or myActiveCallQuery
    }
    if (!pc) {
        console.warn("PeerConnection not available for call status:", currentCallDoc.status);
        return;
    }

    const isCaller = currentCallDoc.callerId === loggedInUser._id;

    if (isCaller && currentCallDoc.status === "ringing" && !currentCallDoc.offer) {
      // This state is handled by initiateNewCall
    }
    else if (!isCaller && currentCallDoc.status === "ringing" && currentCallDoc.offer && !currentCallDoc.answer) {
      // Callee receives offer - this is handled by handleAcceptCall
    }
    else if (isCaller && currentCallDoc.answer && !pc.remoteDescription && (currentCallDoc.status === "answered" || currentCallDoc.status === "ringing")) {
      console.log("Caller: Answer received, setting remote description.", currentCallDoc.answer);
      pc.setRemoteDescription(new RTCSessionDescription(currentCallDoc.answer as RTCSessionDescriptionInit))
        .then(() => {
            console.log("Caller: Remote description set from answer.");
            if (currentCallDoc.calleeIceCandidates) {
                pendingIceCandidatesRef.current = { role: 'callee', candidates: currentCallDoc.calleeIceCandidates as RTCIceCandidateInit[] };
            }
        })
        .catch(err => {
          console.error("Caller: Error setting remote description from answer:", err);
          setCallError("Failed to process call answer.");
        });
    }

    const candidatesToProcess = isCaller ? currentCallDoc.calleeIceCandidates : currentCallDoc.callerIceCandidates;
    const candidateRoleForQueue = isCaller ? 'callee' : 'caller';

    if (candidatesToProcess && candidatesToProcess.length > 0) {
        if (pc.remoteDescription && pc.signalingState !== "closed") {
            console.log(`Processing ${candidatesToProcess.length} ${candidateRoleForQueue} ICE candidates directly.`);
            candidatesToProcess.forEach(candidate => {
                if(pcRef.current && pcRef.current.signalingState !== "closed") {
                    pcRef.current.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit))
                    .catch(err => console.error(`Error adding ${candidateRoleForQueue} ICE candidate:`, err));
                }
            });
        } else if (pc.signalingState !== "closed") {
            console.log(`Queuing ${candidatesToProcess.length} ${candidateRoleForQueue} ICE candidates as remote description not set.`);
            pendingIceCandidatesRef.current = { role: candidateRoleForQueue, candidates: candidatesToProcess as RTCIceCandidateInit[] };
        }
    }
    
    if (["declined", "ended", "missed", "failed"].includes(currentCallDoc.status)) {
        cleanupWebRTC(currentCallDoc._id);
    }
  }, [callDetails, myActiveCallQuery, loggedInUser, createPeerConnection, cleanupWebRTC]);


  const initiateNewCall = useCallback(async (calleeId: Id<"users">) => {
    if (!loggedInUser) { toast.error("You must be logged in to call."); return; }
    if (myActiveCallQuery && !["ended", "declined", "missed", "failed"].includes(myActiveCallQuery.status) ) { 
        toast.error("You are already in a call or one is ringing."); return; 
    }

    cleanupWebRTC(); // Clean before starting new
    // `createPeerConnection` needs `callDetails` to be set for its internal logic to work correctly with `callDetails._id`.
    // This is a bit of a chicken-and-egg. We'll create a dummy call object for `createPeerConnection`
    // then the real one will be created by the mutation.
    // A better way might be to pass the future callId or make createPeerConnection not depend on callDetails._id initially.
    // For now, let's proceed, pcRef will be set.
    
    // Create PC first, then get media, then create offer.
    // The `createPeerConnection` needs a `callDetails._id` to function correctly for ICE candidate sending.
    // This is problematic when initiating a call as the call document doesn't exist yet.
    // We'll call `initiateCallMutation` first, then use its ID.
    
    // Step 1: Get local media first
    const tempPcForMedia = new RTCPeerConnection({ iceServers: ICE_SERVERS }); // Temporary for media
    const mediaStarted = await startLocalMediaAndTracks(tempPcForMedia);
    tempPcForMedia.close(); // Close temporary PC

    if (!mediaStarted || !localStreamRef.current) { 
        toast.error("Could not access microphone.");
        cleanupWebRTC(); 
        return; 
    }

    // Step 2: Create the actual peer connection that will be used.
    // We don't have callDetails._id yet, so onicecandidate might not send immediately.
    // This is okay, candidates will be gathered and can be sent once callDetails is available.
    const pc = createPeerConnection(); // This will set pcRef.current
    if (!pc) { toast.error("Could not initialize call system. Please try again."); cleanupWebRTC(); return; }
    
    // Add tracks from the already acquired localStreamRef
    localStreamRef.current.getTracks().forEach(track => {
        if(pc.signalingState !== "closed") pc.addTrack(track, localStreamRef.current!);
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("Initiating call with offer:", pc.localDescription);
      
      const newCallId = await initiateCallMutation({ calleeId, offer: pc.localDescription!.toJSON() });
      // Now that we have newCallId, `myActiveCallQuery` and `callDetails` will update,
      // and the useEffect watching `callDetails` will handle further logic.
      // The `onicecandidate` handler in `createPeerConnection` will use the updated `callDetails._id`.
      toast.success("Calling...");
      setIsUiVisible(true); // Show UI immediately for outgoing call
      setCallStatusForUI("ringing");
    } catch (err) {
      console.error("Error initiating call sequence:", err);
      toast.error("Error starting call: " + (err as Error).message);
      cleanupWebRTC();
    }
  }, [loggedInUser, myActiveCallQuery, initiateCallMutation, createPeerConnection, startLocalMediaAndTracks, cleanupWebRTC]);

  const handleAcceptCall = async () => {
    const currentCallDoc = callDetails || myActiveCallQuery;
    if (!currentCallDoc || !loggedInUser || currentCallDoc.calleeId !== loggedInUser._id) return;
    
    let pc = pcRef.current;
    if (!pc) pc = createPeerConnection();
    if (!pc) { toast.error("Failed to initialize call resources."); return; }
    // pcRef.current is already set by createPeerConnection if it was null

    const mediaStarted = await startLocalMediaAndTracks(pc);
    if (!mediaStarted) { cleanupWebRTC(currentCallDoc._id); return; }

    try {
      if (!currentCallDoc.offer) {
        toast.error("Cannot answer: Offer not found.");
        setCallError("Call offer missing.");
        return;
      }
      console.log("Callee: Offer received, setting remote description.", currentCallDoc.offer);
      await pc.setRemoteDescription(new RTCSessionDescription(currentCallDoc.offer as RTCSessionDescriptionInit));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log("Callee: Answer created, sending to server.", pc.localDescription);
      await answerCallMutation({ callId: currentCallDoc._id, answer: pc.localDescription!.toJSON() });
      setCallStatusForUI("answered");
      if (currentCallDoc.callerIceCandidates) {
        pendingIceCandidatesRef.current = { role: 'caller', candidates: currentCallDoc.callerIceCandidates as RTCIceCandidateInit[] };
      }
    } catch (err) {
      console.error("Error answering call:", err);
      setCallError("Failed to answer call.");
      toast.error("Error answering call: " + (err as Error).message);
      cleanupWebRTC(currentCallDoc._id);
    }
  };

  const handleDeclineCall = async () => {
    const currentCallId = (callDetails?._id || myActiveCallQuery?._id);
    if (!currentCallId) return;
    try {
      await declineCallMutation({ callId: currentCallId });
      toast.info("Call declined.");
    } catch (err) { console.error("Error declining call:", err); toast.error("Error declining call."); }
    cleanupWebRTC(currentCallId);
  };

  const handleEndCall = async () => {
    const currentCallId = (callDetails?._id || myActiveCallQuery?._id);
    if (!currentCallId) return;
    try {
      await endCallMutation({ callId: currentCallId });
      toast.info("Call ended.");
    } catch (err) { console.error("Error ending call:", err); toast.error("Error ending call.");}
    cleanupWebRTC(currentCallId);
  };
  
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };
  
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.error("Error playing remote audio:", e));
    } else if (!remoteStream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
    }
  }, [remoteStream]);

  let uiContent = null;
  const currentCallForUI = callDetails || myActiveCallQuery;

  if (isUiVisible && currentCallForUI && loggedInUser) {
    const isCurrentUserCaller = currentCallForUI.callerId === loggedInUser._id;
    const otherUserIdForDisplay = isCurrentUserCaller ? currentCallForUI.calleeId : currentCallForUI.callerId;

    if (callStatusForUI === 'ringing' && !isCurrentUserCaller) {
        uiContent = (
          <>
            <div className="flex items-center mb-4">
              <PhoneIncoming size={24} className="text-blue-500 mr-3" />
              <div>
                <p className="font-semibold">Incoming Call</p>
                <p className="text-sm text-gray-600">From: {otherUserIdForDisplay.substring(0,6)}...</p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={handleAcceptCall} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center">
                <AcceptCallIcon size={18} className="mr-2"/> Accept
              </button>
              <button onClick={handleDeclineCall} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center">
                <PhoneOff size={18} className="mr-2"/> Decline
              </button>
            </div>
          </>
        );
      } else if (callStatusForUI === 'ringing' && isCurrentUserCaller) {
         uiContent = (
          <>
            <p className="font-semibold mb-2 text-center">Calling...</p>
            <p className="text-sm text-gray-600 mb-3 text-center">To: {otherUserIdForDisplay.substring(0,6)}...</p>
            <div className="flex justify-center items-center">
              <button onClick={handleEndCall} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors" title="Cancel Call">
                <PhoneOff size={22}/>
              </button>
            </div>
          </>
        );
      } else if (callStatusForUI === 'answered' || callStatusForUI === 'connected') {
         uiContent = (
          <>
            <p className="font-semibold mb-2 text-center">
              {callStatusForUI === 'answered' && 'Connecting...'}
              {callStatusForUI === 'connected' && 'Call Active'}
            </p>
            <p className="text-sm text-gray-600 mb-3 text-center">With: {otherUserIdForDisplay.substring(0,6)}...</p>
            <div className="flex justify-around items-center">
              <button onClick={toggleMute} className="p-3 rounded-full hover:bg-gray-200 transition-colors" title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <MicOff size={22} className="text-gray-700"/> : <Mic size={22} className="text-gray-700"/>}
              </button>
              <button onClick={handleEndCall} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors" title="End Call">
                <PhoneOff size={22}/>
              </button>
            </div>
          </>
        );
      } else if (callError) {
         uiContent = (
            <div className="flex flex-col items-center text-red-500">
                <AlertTriangle size={24} className="mb-2"/>
                <p className="font-semibold">Call Error</p>
                <p className="text-sm">{callError}</p>
                <button onClick={() => cleanupWebRTC(currentCallForUI?._id)} className="mt-2 px-3 py-1 bg-gray-200 rounded text-xs">Dismiss</button>
            </div>
         );
      }
  }

  return (
    <CallContext.Provider value={{ initiateNewCall, activeCallDetails: callDetails || myActiveCallQuery, isMicrophoneBusy: !!localStreamRef.current }}>
      {children}
      {isUiVisible && uiContent && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-xl border border-gray-200 z-50 w-72 min-h-[100px] flex flex-col justify-center items-center">
          {uiContent}
        </div>
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </CallContext.Provider>
  );
}
