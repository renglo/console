"use client"

interface ImagePreviewProps {
  blueprint: {
    fields?: {
      name: string;
      widget?: string;
      cardinality?: string;
    }[];
  };
  data: {
    [key: string]: string | string[] | undefined;
  };
}

function imageUris(value: string | string[] | undefined): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

export default function ImagePreview({ blueprint, data }: ImagePreviewProps) {
  return (
    <>
      {blueprint?.fields?.filter((field) => field.widget === "image").flatMap((field) =>
        imageUris(data[field.name]).map((uri, index) => (
          <img
            key={`${field.name}-${index}`}
            src={`${import.meta.env.VITE_API_URL}/${uri}`}
            alt={field.name}
          />
        )),
      )}
    </>
  );
}
