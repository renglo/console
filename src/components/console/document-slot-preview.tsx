import {
  fileNameFromUri,
  storedFileHref,
} from "@/lib/image-upload";

interface DocumentSlotPreviewProps {
  file?: File | null;
  uri?: string;
  label?: string;
}

/** Show a pending local document filename or a link to a stored document URI. */
export default function DocumentSlotPreview({
  file,
  uri = "",
  label = "Document",
}: DocumentSlotPreviewProps) {
  if (file) {
    return (
      <p className="text-sm text-foreground break-all">
        Selected: <span className="font-medium">{file.name}</span>
      </p>
    );
  }

  const href = storedFileHref(uri);
  if (!href) return null;

  const name = fileNameFromUri(uri) || label;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-primary underline-offset-4 hover:underline break-all"
    >
      {name}
    </a>
  );
}
