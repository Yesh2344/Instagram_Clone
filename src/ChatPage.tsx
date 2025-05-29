import { useState, useEffect } from "react";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import { Id } from "../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { UserPlus, MessageSquare } from "lucide-react";

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    Id<"conversations"> | null
  >(null);
  const [showUserList, setShowUserList] = useState(false);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const markAsRead = useMutation(api.chat.markConversationAsRead);

  useEffect(() => {
    if (selectedConversationId) {
      markAsRead({ conversationId: selectedConversationId });
    }
  }, [selectedConversationId, markAsRead]);

  const handleSelectConversation = (conversationId: Id<"conversations">) => {
    setSelectedConversationId(conversationId);
    setShowUserList(false);
  };

  const handleStartNewChat = () => {
    setSelectedConversationId(null);
    setShowUserList(true);
  };
  
  const handleUserSelectedForNewChat = (conversationId: Id<"conversations">) => {
    setSelectedConversationId(conversationId);
    setShowUserList(false);
  };

  if (!loggedInUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Please sign in to use chat.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <ChatSidebar
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onStartNewChat={handleStartNewChat}
        showUserList={showUserList}
        onUserSelectedForNewChat={handleUserSelectedForNewChat}
        onCloseUserList={() => setShowUserList(false)}
      />
      <div className="flex-1 flex flex-col bg-white">
        {selectedConversationId ? (
          <ChatWindow conversationId={selectedConversationId} />
        ) : !showUserList && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
            <MessageSquare size={48} className="mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
            <p className="text-sm mb-4">Or start a new one to begin chatting.</p>
            <button
              onClick={handleStartNewChat}
              className="flex items-center px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
            >
              <UserPlus size={18} className="mr-2" />
              Start New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
