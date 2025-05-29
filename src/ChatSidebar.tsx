import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { CircleUserRound, MessageSquarePlus, Users, X } from "lucide-react";
import UserListForChat from "./UserListForChat";
import { formatDistanceToNowStrict } from 'date-fns';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const getUserStatus = (lastSeen: number | undefined | null): { isOnline: boolean; statusText: string } => {
  if (!lastSeen) return { isOnline: false, statusText: "Offline" };
  const now = Date.now();
  if (now - lastSeen < ONLINE_THRESHOLD_MS) {
    return { isOnline: true, statusText: "Online" };
  }
  return { isOnline: false, statusText: `Last seen ${formatDistanceToNowStrict(new Date(lastSeen), { addSuffix: true })}` };
};

interface ChatSidebarProps {
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (conversationId: Id<"conversations">) => void;
  onStartNewChat: () => void;
  showUserList: boolean;
  onUserSelectedForNewChat: (conversationId: Id<"conversations">) => void;
  onCloseUserList: () => void;
}

export default function ChatSidebar({
  selectedConversationId,
  onSelectConversation,
  onStartNewChat,
  showUserList,
  onUserSelectedForNewChat,
  onCloseUserList,
}: ChatSidebarProps) {
  const conversations = useQuery(api.chat.listConversations) || [];
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const markAsRead = useMutation(api.chat.markConversationAsRead);

  if (!loggedInUser) return null;

  const handleConversationClick = (conversationId: Id<"conversations">) => {
    onSelectConversation(conversationId);
    // Optimistically mark as read on client, server will confirm
    // This is already handled in ChatPage.tsx useEffect, but can be here too for immediate UI feedback if needed.
    // For now, relying on ChatPage.tsx to call markAsRead.
  };

  return (
    <div className="w-full md:w-80 lg:w-96 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Chats</h2>
        {!showUserList && (
          <button
            onClick={onStartNewChat}
            className="p-2 text-pink-600 hover:bg-pink-100 rounded-full transition-colors"
            title="Start new chat"
          >
            <MessageSquarePlus size={22} />
          </button>
        )}
         {showUserList && (
          <button
            onClick={onCloseUserList}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
            title="Close"
          >
            <X size={22} />
          </button>
        )}
      </div>

      {showUserList ? (
        <UserListForChat onUserSelected={onUserSelectedForNewChat} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-gray-500 text-center">
              No active conversations. Start a new chat!
            </p>
          )}
          {conversations.map((convo) => {
            const otherParticipant = convo.isDirectMessage ? convo.otherParticipant : null;
            const displayName = otherParticipant?.name ?? otherParticipant?.email ?? convo.name ?? "Conversation";
            const displayImage = otherParticipant?.image ?? convo.image;
            const userStatus = otherParticipant ? getUserStatus(otherParticipant.lastSeen) : null;
            const typingNames = convo.typingUsers?.map(u => u.name).join(', ');
            const hasUnread = convo.unreadCount && convo.unreadCount > 0;

            return (
              <div
                key={convo._id}
                onClick={() => handleConversationClick(convo._id)}
                className={`p-3 flex items-center space-x-3 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100 relative
                  ${selectedConversationId === convo._id ? "bg-pink-50 border-l-4 border-pink-500" : ""}
                  ${hasUnread && selectedConversationId !== convo._id ? "font-semibold" : ""}`}
              >
                <div className="relative">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                      {convo.isGroup ? <Users size={20}/> : <CircleUserRound size={24} />}
                    </div>
                  )}
                  {userStatus?.isOnline && !convo.isGroup && (
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={`truncate ${hasUnread && selectedConversationId !== convo._id ? "text-pink-700" : "text-gray-800"}`}>
                      {displayName}
                    </p>
                    {hasUnread && selectedConversationId !== convo._id && (
                      <span className="ml-2 bg-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                  {typingNames && typingNames.length > 0 ? (
                     <p className="text-xs text-pink-500 italic truncate">
                       {typingNames} {convo.typingUsers && convo.typingUsers.length > 1 ? 'are' : 'is'} typing...
                     </p>
                  ) : convo.lastMessageContent ? (
                    <p className={`text-xs truncate ${hasUnread && selectedConversationId !== convo._id ? "text-gray-700" : "text-gray-500"}`}>
                      {convo.lastMessageContent}
                    </p>
                  ) : userStatus && !userStatus.isOnline && !convo.isGroup ? (
                     <p className="text-xs text-gray-400 truncate">{userStatus.statusText}</p>
                  ) : (
                    <p className="text-xs text-gray-400 truncate">{convo.isGroup ? "Group chat" : "No messages yet"}</p>
                  )}
                </div>
                {convo.lastMessageTimestamp && !typingNames && (
                   <p className={`text-xs whitespace-nowrap self-start mt-1 ${hasUnread && selectedConversationId !== convo._id ? "text-pink-600" : "text-gray-400"}`}>
                     {new Date(convo.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                 )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
