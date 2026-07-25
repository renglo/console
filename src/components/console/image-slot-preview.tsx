import { useEffect, useState } from "react";

function remoteImageSrc(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  // Stored file paths contain "/"; pending local filenames do not.
  if (!trimmed.includes("/")) return null;
  return `${import.meta.env.VITE_API_URL}/${trimmed}`;
}

interface ImageSlotPreviewProps {
  file?: File | null;
  uri?: string;
  alt?: string;
  className?: string;
}

/** Preview a pending local File or an already-stored URI. */
export default function ImageSlotPreview({
  file,
  uri = "",
  alt = "Image preview",
  className = "max-h-48 max-w-full rounded-md object-contain",
}: ImageSlotPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const src = objectUrl ?? remoteImageSrc(uri);
  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}
