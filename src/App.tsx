import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import UploadView from "./UploadView";
import StreamView from "./StreamView";
import MyPhotosView from "./MyPhotosView";
import ChatPage from "./ChatPage";
import CallManager from "./CallManager";
import { CallContext } from "./CallContext"; // Import CallContext
import { MessageSquare, Image, Upload, UserCircle } from "lucide-react";
import { Id } from "../convex/_generated/dataModel"; // For CallContext provider value

type Tab = "stream" | "myPhotos" | "upload" | "chat";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("stream");
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const heartbeat = useMutation(api.users.heartbeat);

  // Placeholder for CallManager's exposed functions - CallManager itself will provide the actual implementation
  const dummyInitiateNewCall = async (_calleeId: Id<"users">) => {
    console.warn("dummyInitiateNewCall called from App.tsx context placeholder");
    // Actual implementation will be in CallManager's context provider value
  };

  useEffect(() => {
    if (loggedInUser) {
      heartbeat({});
      const intervalId = setInterval(() => {
        heartbeat({});
      }, 60 * 1000); 
      const handleFocus = () => heartbeat({});
      window.addEventListener("focus", handleFocus);
      return () => {
        clearInterval(intervalId);
        window.removeEventListener("focus", handleFocus);
      };
    }
  }, [loggedInUser, heartbeat]);

  return (
    // CallManager will provide the actual context value.
    // This App component doesn't directly manage call state for the context,
    // but CallManager, rendered within Authenticated, will.
    // So, we can wrap Authenticated content with CallManager which itself is the provider.
    // Or CallManager provides context internally, and ChatWindow consumes it.
    // Let's have CallManager be the provider.
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md h-16 flex justify-between items-center border-b shadow-sm px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-pink-600">InstaConvex</h2>
        <div className="flex items-center gap-4">
          {loggedInUser && (
            <span className="text-sm text-gray-600 hidden sm:block">
              {loggedInUser.name ?? loggedInUser.email}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>

      <Unauthenticated>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md mx-auto bg-white p-8 rounded-xl shadow-xl">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-pink-600 mb-2">
                Welcome to InstaConvex!
              </h1>
              <p className="text-gray-500">Sign in to share and see photos.</p>
            </div>
            <SignInForm />
          </div>
        </main>
      </Unauthenticated>

      <Authenticated>
        {/* CallManager now acts as its own Context Provider */}
        <CallManager>
          <nav className="bg-white shadow-md sticky top-16 z-10">
            <div className="max-w-5xl mx-auto px-2 sm:px-6 lg:px-8">
              <div className="flex justify-around sm:justify-center h-14 space-x-0 sm:space-x-8">
                <TabButton
                  label="Stream"
                  icon={<Image size={20} />}
                  isActive={activeTab === "stream"}
                  onClick={() => setActiveTab("stream")}
                />
                <TabButton
                  label="My Photos"
                  icon={<UserCircle size={20} />}
                  isActive={activeTab === "myPhotos"}
                  onClick={() => setActiveTab("myPhotos")}
                />
                <TabButton
                  label="Upload"
                  icon={<Upload size={20} />}
                  isActive={activeTab === "upload"}
                  onClick={() => setActiveTab("upload")}
                />
                <TabButton
                  label="Chat"
                  icon={<MessageSquare size={20} />}
                  isActive={activeTab === "chat"}
                  onClick={() => setActiveTab("chat")}
                />
              </div>
            </div>
          </nav>

          <main className="flex-1">
            {activeTab === "chat" ? (
              <ChatPage />
            ) : (
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-5xl mx-auto">
                  {activeTab === "stream" && <StreamView />}
                  {activeTab === "myPhotos" && <MyPhotosView />}
                  {activeTab === "upload" && <UploadView />}
                </div>
              </div>
            )}
          </main>
        </CallManager>
      </Authenticated>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function TabButton({
  label,
  icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col sm:flex-row items-center justify-center sm:space-x-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all duration-150 ease-in-out w-1/4 sm:w-auto
        ${
          isActive
            ? "border-pink-500 text-pink-600"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
        }
        focus:outline-none focus:text-gray-700 focus:border-gray-300`}
    >
      {icon}
      <span className="mt-1 sm:mt-0">{label}</span>
    </button>
  );
}
