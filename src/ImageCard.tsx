import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";

interface ImageType {
  _id: Id<"images">;
  _creationTime: number;
  userId: Id<"users">;
  storageId: Id<"_storage">;
  likes: Id<"users">[];
  caption?: string | undefined;
  url: string | null;
  uploaderName?: string;
  uploaderImage?: string | null;
  isLikedByCurrentUser: boolean;
}

interface ImageCardProps {
  image: ImageType;
  showDeleteButton?: boolean;
  onDelete?: (imageId: Id<"images">, storageId: Id<"_storage">) => void;
}

export default function ImageCard({
  image,
  showDeleteButton = false,
  onDelete,
}: ImageCardProps) {
  const likeImage = useMutation(api.images.likeImage);
  const unlikeImage = useMutation(api.images.unlikeImage);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [isLiking, setIsLiking] = useState(false);

  const handleLikeToggle = async () => {
    if (!loggedInUser) {
      toast.error("You must be signed in to like photos.");
      return;
    }
    if (isLiking) return;
    setIsLiking(true);
    try {
      if (image.isLikedByCurrentUser) {
        await unlikeImage({ imageId: image._id });
      } else {
        await likeImage({ imageId: image._id });
      }
    } catch (error) {
      console.error("Failed to update like status:", error);
      toast.error("Could not update like status.");
    } finally {
      setIsLiking(false);
    }
  };

  if (!image.url) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden animate-pulse">
        <div className="w-full h-64 bg-gray-300"></div>
        <div className="p-4">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all hover:shadow-2xl duration-300 ease-in-out">
      <div className="p-4 flex items-center space-x-3 border-b border-gray-200">
        {image.uploaderImage ? (
          <img
            src={image.uploaderImage}
            alt={image.uploaderName ?? "Uploader"}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-lg font-semibold">
            {image.uploaderName?.charAt(0).toUpperCase() ?? "A"}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {image.uploaderName ?? "Anonymous"}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(image._creationTime).toLocaleDateString()}
          </p>
        </div>
      </div>

      <img
        src={image.url}
        alt={image.caption ?? "User upload"}
        className="w-full h-auto max-h-[70vh] object-contain bg-gray-100"
      />

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={handleLikeToggle}
            disabled={!loggedInUser || isLiking}
            className={`flex items-center space-x-1 text-sm transition-colors duration-150
              ${
                image.isLikedByCurrentUser
                  ? "text-pink-500 hover:text-pink-600"
                  : "text-gray-500 hover:text-gray-700"
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg
              className={`w-5 h-5 sm:w-6 sm:h-6 ${
                image.isLikedByCurrentUser ? "fill-current" : "stroke-current"
              }`}
              fill={image.isLikedByCurrentUser ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              ></path>
            </svg>
            <span>{image.likes.length}</span>
          </button>

          {showDeleteButton &&
            onDelete &&
            loggedInUser?._id === image.userId && ( // Changed loggedInUser.id to loggedInUser._id
              <button
                onClick={() => onDelete(image._id, image.storageId)}
                className="text-xs text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-100"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </button>
            )}
        </div>
        {image.caption && (
          <p className="text-sm text-gray-700">
            <span className="font-semibold">
              {image.uploaderName ?? "Anonymous"}:
            </span>{" "}
            {image.caption}
          </p>
        )}
      </div>
    </div>
  );
}
