## Overview

This application allows users to:
*   Sign up and log in using a simple username/password system.
*   Upload photos with captions.
*   View a stream of photos from other users.
*   View their own uploaded photos.
*   Like photos.
*   Engage in real-time one-on-one chat conversations with other users.
*   See user online status and typing indicators in chat.
*   Initiate and receive real-time voice calls using WebRTC.


## Features

### 1. Photo Sharing
*   **Upload Photos:** Users can upload images with an optional caption.
*   **Photo Stream:** A main feed displaying photos from all users, sorted by creation time.
*   **My Photos:** A dedicated view for users to see and manage their own uploaded photos.
*   **Like Photos:** Users can like and unlike photos.

### 2. Real-time Chat
*   **User List:** View a list of users to start new conversations.
*   **Conversations:** Engage in one-on-one text-based conversations.
*   **Real-time Updates:** Messages appear instantly without needing to refresh.
*   **Online Status:** See if other users are currently online or their last seen time.
*   **Typing Indicators:** See when the other user is typing a message.
*   **Unread Message Counts:** Visual indicators for unread messages in conversations.

### 3. WebRTC Voice Calling
*   **Initiate Calls:** Start a voice call with another user directly from the chat window.
*   **Receive Calls:** Get notified of incoming calls with options to accept or decline.
*   **In-Call UI:** A floating UI displays call status (ringing, connecting, active) and controls (mute, end call).
*   **Microphone Management:** Handles microphone access and provides feedback.
*   **Call Statuses:** The system manages various call states like ringing, answered, connected, declined, ended, busy, failed, and missed.

## Tech Stack

*   **Frontend:**
    *   [Vite](https://vitejs.dev/): Fast build tool and development server.
    *   [React](https://reactjs.org/): JavaScript library for building user interfaces.
    *   [TailwindCSS](https://tailwindcss.com/): Utility-first CSS framework for styling.
    *   [Sonner](https://sonner.emilkowal.ski/): Toast notifications for React.
    *   [Lucide Icons](https://lucide.dev/): Simply beautiful open-source icons.
    *   [date-fns](https://date-fns.org/): Modern JavaScript date utility library.

*   **Backend & Database:**
    *   [Convex](https://convex.dev/): Reactive backend-as-a-service platform providing:
        *   Real-time Database
        *   Serverless Functions (Queries and Mutations)
        *   Authentication (via `@convex-dev/auth`)
        *   File Storage
*   **Language:** TypeScript

## Project Structure Highlights

*   `convex/`: Contains all backend code, including schema definitions, queries, mutations, and authentication configuration.
    *   `schema.ts`: Defines the database schema for users, images, conversations, chat messages, and calls.
    *   `images.ts`: Handles image upload, liking, and fetching logic.
    *   `chat.ts`: Manages chat conversations, messages, and typing indicators.
    *   `calls.ts`: Implements the signaling logic for WebRTC calls.
    *   `users.ts`: Manages user-related data like online status.
    *   `auth.config.ts` & `auth.ts`: Configure Convex authentication.
*   `src/`: Contains all frontend React components and application logic.
    *   `App.tsx`: Main application component, handles routing and layout.
    *   `CallManager.tsx`: Core component managing WebRTC call state, peer connections, and UI.
    *   `CallContext.tsx`: React context for providing call-related functions and state to components.
    *   `ChatPage.tsx`: Main component for the chat interface, combining `ChatSidebar` and `ChatWindow`.
    *   `ChatSidebar.tsx`: Displays a list of conversations and users to chat with.
    *   `ChatWindow.tsx`: Displays messages for a selected conversation and input for sending new messages.
    *   `UploadView.tsx`, `StreamView.tsx`, `MyPhotosView.tsx`: Components for different photo-related views.
    *   `SignInForm.tsx` & `SignOutButton.tsx`: Authentication UI components.

## Setup and Running

This project is set up to run in a Convex Chef environment.

1.  **Environment Variables:**
    *   The application relies on Convex for its backend. Ensure your Convex project is properly configured.
    *   No explicit API keys are needed for the core functionality if using the built-in Convex features.

2.  **Installation:**
    *   Dependencies are typically pre-installed in the Chef environment. If running locally, you would use `npm install`.

3.  **Running the Development Server:**
    *   In the Chef environment, deploying the code will automatically start the Vite development server.
    *   Locally, you would typically run `npx convex dev` which starts both the Convex backend services and the Vite frontend.

## How WebRTC Calling Works

The WebRTC calling feature uses a signaling mechanism built with Convex mutations and queries:

1.  **Initiation (`initiateCall`):**
    *   The caller creates an RTCPeerConnection.
    *   An "offer" (Session Description Protocol - SDP) is generated.
    *   The offer is sent to the callee via a Convex mutation, creating a `calls` document with status "ringing".
    *   ICE candidates (network information) are gathered and sent via `sendIceCandidate` mutation, updating the `calls` document.

2.  **Answering (`answerCall`):**
    *   The callee is notified of the "ringing" call (via a reactive query `getMyActiveCall`).
    *   If accepted, the callee creates an RTCPeerConnection.
    *   The caller's offer (from the `calls` document) is set as the remote description.
    *   An "answer" (SDP) is generated by the callee.
    *   The answer is sent back to the caller via the `answerCall` mutation, updating the `calls` document status to "answered".
    *   Callee's ICE candidates are gathered and sent.

3.  **Connection Establishment:**
    *   The caller receives the answer and sets it as their remote description.
    *   Both caller and callee exchange ICE candidates (fetched from the `calls` document).
    *   The RTCPeerConnection on both sides attempts to establish a direct peer-to-peer connection.
    *   Once the WebRTC connection state becomes "connected", the `markCallAsConnected` mutation is called to update the `calls` document status to "connected".

4.  **Call Management:**
    *   `declineCall`: Allows a callee to decline a ringing call or a caller to cancel it.
    *   `endCall`: Allows either participant to terminate an active or ringing call.
    *   `CallManager.tsx` handles the client-side WebRTC logic, state management, and UI updates based on the `calls` document changes.
    *   `getMyActiveCall` and `getCallDetails` queries provide real-time updates to the UI about call status and details.

This setup allows for robust call signaling and management using Convex's real-time capabilities.
"# Instagram_Clone" 

## Link

https://quirky-seal-814.convex.app/

## Copyrights

@Yeswanth Soma All Copyrights Reserved

## Contact

Email: yeswanthsoma83@gmail.com
