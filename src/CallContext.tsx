import { createContext, useContext } from 'react';
import { Id, Doc } from '../convex/_generated/dataModel'; // Import Doc

interface CallContextType {
  initiateNewCall: (calleeId: Id<"users">) => Promise<void>;
  activeCallDetails?: Doc<"calls"> | null; 
  isMicrophoneBusy: boolean;
}

export const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
