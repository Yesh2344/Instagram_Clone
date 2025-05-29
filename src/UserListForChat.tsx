import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { CircleUserRound, Send } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNowStrict } from 'date-fns';

// Helper to determine online status and format lastSeen
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const getUserStatus = (lastSeen: number | undefined | null): { isOnline: boolean; statusText: string } => {
  if (!lastSeen) return { isOnline: false, statusText: "Offline" };
  const now = Date.now();
  if (now - lastSeen < ONLINE_THRESHOLD_MS) {
    return { isOnline: true, statusText: "Online" };
  }
  return { isOnline: false, statusText: `Last seen ${formatDistanceToNowStrict(new Date(lastSeen), { addSuffix: true })}` };
};


interface UserListForChatProps {
  onUserSelected: (conversationId: Id<"conversations">) => void;
}

export default function UserListForChat({ onUserSelected }: UserListForChatProps) {
  const users = useQuery(api.chat.listUsersForChat) || [];
  const getOrCreateDM = useMutation(api.chat.getOrCreateDMConversation);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});


  const handleStartChat = async (otherUserId: Id<"users">) => {
    setIsLoading(prev => ({ ...prev, [otherUserId]: true }));
    try {
      const conversationId = await getOrCreateDM({ otherUserId });
      onUserSelected(conversationId);
    } catch (error) {
      console.error("Failed to start chat:", error);
      toast.error("Could not start chat. " + (error as Error).message);
    } finally {
      setIsLoading(prev => ({ ...prev, [otherUserId]: false }));
    }
  };

  if (users === undefined) {
    return <div className="p-4 text-center text-gray-500">Loading users...</div>;
  }
  if (users.length === 0) {
    return <div className="p-4 text-center text-gray-500">No other users found to chat with.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <h3 className="text-md font-semibold text-gray-700 p-2 sticky top-0 bg-gray-50 z-10">Start a new chat</h3>
      {users.map((user) => {
        const userStatus = getUserStatus(user.lastSeen);
        return (
          <div
            key={user._id}
            className="p-3 flex items-center justify-between space-x-3 cursor-pointer hover:bg-gray-100 transition-colors rounded-md"
            onClick={() => !isLoading[user._id] && handleStartChat(user._id)}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="relative">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name ?? user.email ?? "User"}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                    <CircleUserRound size={24} />
                  </div>
                )}
                {userStatus.isOnline && (
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {user.name ?? user.email ?? "Unnamed User"}
                </p>
                <p className={`text-xs truncate ${userStatus.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                  {userStatus.statusText}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation(); 
                handleStartChat(user._id);
              }}
              disabled={isLoading[user._id]}
              className="p-2 text-pink-600 hover:bg-pink-100 rounded-full transition-colors disabled:opacity-50"
              title={`Chat with ${user.name ?? user.email}`}
            >
              {isLoading[user._id] ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-600"></div>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
