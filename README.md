# InstaConvex - Photo Sharing and Real-time Communication App

InstaConvex is a full-stack web application that combines Instagram-like photo sharing capabilities with real-time chat and WebRTC-based voice calling features. It's built using Vite, React, and Convex for a reactive and modern user experience.

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

