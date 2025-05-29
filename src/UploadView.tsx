import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export default function UploadView() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const createImage = useMutation(api.images.createImage);
  const [isUploading, setIsUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast.error("No file selected or file type not supported.");
        return;
      }
      const file = acceptedFiles[0];
      setIsUploading(true);
      try {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const json = await result.json();
        if (!result.ok) {
          throw new Error(`Upload failed: ${JSON.stringify(json)}`);
        }
        const { storageId } = json as { storageId: Id<"_storage"> };
        await createImage({ storageId, caption });
        toast.success("Image uploaded successfully!");
        setCaption(""); // Reset caption
      } catch (error) {
        console.error(error);
        toast.error("Failed to upload image. " + (error as Error).message);
      } finally {
        setIsUploading(false);
      }
    },
    [generateUploadUrl, createImage, caption]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".gif", ".jpeg", ".jpg", ".webp"] },
    multiple: false,
  });

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 bg-white rounded-xl shadow-xl">
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-6 text-center">
        Upload Your Photo
      </h2>
      <div
        {...getRootProps()}
        className={`p-8 sm:p-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out
          ${
            isDragActive
              ? "border-pink-500 bg-pink-50"
              : "border-gray-300 hover:border-gray-400"
          }
          flex flex-col items-center justify-center text-center`}
        style={{ minHeight: "200px" }}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mb-4"></div>
            <p className="text-gray-600">Uploading...</p>
          </div>
        ) : isDragActive ? (
          <p className="text-pink-600 font-medium">Drop the file here ...</p>
        ) : (
          <>
            <svg
              className="w-12 h-12 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="text-gray-500">
              Drag 'n' drop an image here, or click to select file
            </p>
            <p className="text-xs text-gray-400 mt-1">
              (PNG, JPG, GIF, WEBP)
            </p>
          </>
        )}
      </div>
      <div className="mt-6">
        <label
          htmlFor="caption"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Caption (Optional)
        </label>
        <textarea
          id="caption"
          rows={3}
          className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-shadow shadow-sm hover:shadow"
          placeholder="Add a caption to your photo..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={isUploading}
        />
      </div>
      <button
        onClick={() => {
          // This button is mainly for styling consistency,
          // the dropzone itself handles the click to open file dialog.
          // We can also trigger file dialog programmatically if needed.
          const inputElem = document.querySelector(
            'input[type="file"]'
          ) as HTMLInputElement;
          inputElem?.click();
        }}
        disabled={isUploading}
        className="mt-6 w-full px-4 py-3 rounded-md bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? "Uploading..." : "Select or Drop Image"}
      </button>
    </div>
  );
}
