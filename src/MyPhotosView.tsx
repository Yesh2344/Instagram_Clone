import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import ImageCard from "./ImageCard";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export default function MyPhotosView() {
  const userImages = useQuery(api.images.getUserImages);
  const deleteImageMutation = useMutation(api.images.deleteImage);

  const handleDelete = async (
    imageId: Id<"images">,
    storageId: Id<"_storage">
  ) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this photo? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      await deleteImageMutation({ imageId, storageId });
      toast.success("Photo deleted successfully.");
    } catch (error) {
      console.error("Failed to delete photo:", error);
      toast.error("Failed to delete photo. " + (error as Error).message);
    }
  };

  if (userImages === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-lg overflow-hidden animate-pulse"
          >
            <div className="w-full h-64 bg-gray-300"></div>
            <div className="p-4">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (userImages.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900">
          You haven't uploaded any photos yet.
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Go to the "Upload" tab to share your first photo!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
      {userImages.map(
        (image) =>
          image && (
            <ImageCard
              key={image._id}
              image={image}
              showDeleteButton={true}
              onDelete={handleDelete}
            />
          )
      )}
    </div>
  );
}
