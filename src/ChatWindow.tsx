import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { FormEvent, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { CircleUserRound, Send, Phone } from "lucide-react";
import { formatDistanceToNowStrict } from 'date-fns';
import { useCall } from "./CallContext"; // Import useCall

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) { clearTimeout(timeout); }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; 

const getUserStatus = (lastSeen: number | undefined | null): { isOnline: boolean; statusText: string } => {
  if (!lastSeen) return { isOnline: false, statusText: "Offline" };
  const now = Date.now();
  if (now - lastSeen < ONLINE_THRESHOLD_MS) {
    return { isOnline: true, statusText: "Online" };
  }
  return { isOnline: false, statusText: `Last seen ${formatDistanceToNowStrict(new Date(lastSeen), { addSuffix: true })}` };
};

interface ChatWindowProps {
  conversationId: Id<"conversations">;
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const messages = useQuery(api.chat.getMessages, { conversationId });
  const sendMessageMutation = useMutation(api.chat.sendMessage);
  const setTypingMutation = useMutation(api.chat.setTyping);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationDetails = useQuery(api.chat.listConversations)?.find(c => c._id === conversationId);
  const { initiateNewCall, isMicrophoneBusy, activeCallDetails } = useCall(); // Consume CallContext

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetNotTyping = useCallback(
    debounce(() => {
      if (conversationId) setTypingMutation({ conversationId, typing: false });
    }, 2000),
    [setTypingMutation, conversationId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim() !== "" && conversationId) {
      setTypingMutation({ conversationId, typing: true });
      debouncedSetNotTyping();
    } else if (conversationId) {
      setTypingMutation({ conversationId, typing: false });
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !loggedInUser || !conversationId) return;
    setIsSending(true);
    try {
      await sendMessageMutation({ conversationId, content: newMessage });
      setNewMessage("");
      setTypingMutation({ conversationId, typing: false });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. " + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };
  
  const getConversationPartnerInfo = () => {
    if (!conversationDetails || !loggedInUser) return { id: null, name: "Chat", status: {isOnline: false, statusText: ""} };
    if (conversationDetails.isGroup) return { id: null, name: conversationDetails.groupName ?? "Group Chat", status: {isOnline: false, statusText: "Group"} };
    const otherP = conversationDetails.otherParticipant;
    const name = otherP?.name ?? otherP?.email ?? conversationDetails.name ?? "Chat";
    const status = getUserStatus(otherP?.lastSeen);
    return { id: otherP?._id || null, name, status };
  };

  const partnerInfo = getConversationPartnerInfo();
  
  const typingUsersDisplay = conversationDetails?.typingUsers
    ?.filter(u => u.id !== loggedInUser?._id)
    .map(u => u.name)
    .join(', ');

  const handleCallButtonClick = async () => {
    if (!partnerInfo.id) {
      toast.error("Partner information not available.");
      return;
    }
    if (isMicrophoneBusy || (activeCallDetails && activeCallDetails.status !== "ended" && activeCallDetails.status !== "declined" && activeCallDetails.status !== "failed" && activeCallDetails.status !== "missed")) {
        toast.error("Cannot start a new call while another is active or microphone is busy.");
        return;
    }
    try {
      await initiateNewCall(partnerInfo.id);
    } catch (error) {
      toast.error("Failed to start call: " + (error as Error).message);
    }
  };

  if (messages === undefined || conversationDetails === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }
  
  const canCall = !conversationDetails.isGroup && partnerInfo.id && (!activeCallDetails || ["ended", "declined", "failed", "missed"].includes(activeCallDetails.status)) && !isMicrophoneBusy;


  return (
    <div className="flex-1 flex flex-col h-full">
       <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{partnerInfo.name}</h3>
          {!conversationDetails.isGroup && (
              <p className={`text-xs ${partnerInfo.status.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
              {partnerInfo.status.statusText}
              </p>
          )}
          {typingUsersDisplay && typingUsersDisplay.length > 0 && (
            <p className="text-xs text-pink-500 italic h-4">
              {typingUsersDisplay} {conversationDetails.typingUsers && conversationDetails.typingUsers.length > 1 ? 'are' : 'is'} typing...
            </p>
          )}
          {(!typingUsersDisplay || typingUsersDisplay.length === 0) && <div className="h-4"></div>}
        </div>
        {canCall && (
            <button 
                onClick={handleCallButtonClick}
                title={`Call ${partnerInfo.name}`}
                className="p-2 text-pink-600 hover:bg-pink-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canCall}
            >
                <Phone size={20} />
            </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.map((msg) => (
          <div key={msg._id} className={`flex ${msg.isCurrentUser ? "justify-end" : "justify-start"}`}>
            <div className="flex items-end space-x-2 max-w-xs sm:max-w-md md:max-w-lg">
              {!msg.isCurrentUser && (
                msg.senderImage ? (
                  <img src={msg.senderImage} alt={msg.senderName} className="w-8 h-8 rounded-full object-cover self-start"/>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 self-start">
                     <CircleUserRound size={18}/>
                  </div>
                )
              )}
              <div className={`px-4 py-2 rounded-xl break-words ${msg.isCurrentUser ? "bg-pink-500 text-white rounded-br-none" : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"}`}>
                <p className="text-sm">{msg.content}</p>
                 <p className={`text-xs mt-1 ${msg.isCurrentUser ? 'text-pink-100' : 'text-gray-400'} text-right`}>
                    {new Date(msg._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
               {msg.isCurrentUser && (
                loggedInUser?.image ? (
                  <img src={loggedInUser.image} alt={loggedInUser.name ?? "You"} className="w-8 h-8 rounded-full object-cover self-start"/>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-pink-200 flex items-center justify-center text-pink-700 self-start">
                     <CircleUserRound size={18}/>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-shadow shadow-sm hover:shadow"
            disabled={isSending}
          />
          <button type="submit" disabled={isSending || newMessage.trim() === ""} className="p-3 rounded-full bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSending ? (<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>) : (<Send size={20} />)}
          </button>
        </div>
      </form>
    </div>
  );
}
