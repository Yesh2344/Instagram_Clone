import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import ImageCard from "./ImageCard";

export default function StreamView() {
  const images = useQuery(api.images.getGlobalFeed);

  if (images === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {[...Array(6)].map((_, i) => (
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

  if (images.length === 0) {
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
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900">
          No photos yet
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Be the first to share a photo!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {images.map(
        (image) => image && <ImageCard key={image._id} image={image} />
      )}
    </div>
  );
}
