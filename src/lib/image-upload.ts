/** Pending local files keyed by blueprint field name (parallel to form URI values). */
export type PendingFileSlots = Record<string, (File | null)[]>;

/** @deprecated Prefer PendingFileSlots — kept for existing image imports. */
export type PendingImageFiles = PendingFileSlots;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCUMENT_EXTENSIONS = new Set([".pdf", ".txt", ".doc", ".docx"]);

export function isAcceptedImageFile(file: File): boolean {
  return IMAGE_MIME_TYPES.has(file.type);
}

export function isAcceptedDocumentFile(file: File): boolean {
  if (DOCUMENT_MIME_TYPES.has(file.type)) return true;
  // Some browsers leave type empty for .doc/.docx — fall back to extension.
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return DOCUMENT_EXTENSIONS.has(name.slice(dot));
}

/**
 * Map a `_data` URL to the file upload endpoint.
 * Uploads are always POST `/_files/{portfolio}/{org}/{ring}` — never include a document id.
 * form-put paths look like `/_data/.../ring/{docId}`; stripping the trailing id avoids 405.
 */
export function dataPathToFilesPath(dataPath: string): string {
  const withoutQuery = dataPath.split("?")[0] ?? dataPath;
  const filesPath = withoutQuery.replace(/_data/g, "_files");
  const match = filesPath.match(/^(.*?\/_files\/[^/]+\/[^/]+\/[^/]+)/);
  return match ? match[1] : filesPath;
}

function resolveUploadMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return file.type || "application/octet-stream";
}

/** Upload one file via the `_files` API and return its stored path/URI. */
export async function uploadStoredFile(file: File, dataPath: string): Promise<string> {
  const formData = new FormData();
  formData.append("up_file", file, file.name);
  formData.append("up_file_type", resolveUploadMimeType(file));

  const uploadResponse = await fetch(dataPathToFilesPath(dataPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionStorage.accessToken}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("File upload failed");
  }

  const uploadResult = await uploadResponse.json();
  const path = uploadResult?.path;
  if (typeof path !== "string" || !path) {
    throw new Error("File upload returned no path");
  }
  return path;
}

/** @deprecated Prefer uploadStoredFile. */
export async function uploadImageFile(file: File, dataPath: string): Promise<string> {
  return uploadStoredFile(file, dataPath);
}

function normalizeUriList(currentValue: unknown, isMultiple: boolean): string[] {
  if (isMultiple) {
    if (Array.isArray(currentValue)) {
      return currentValue.map((entry) => String(entry ?? "").trim());
    }
    if (currentValue == null || currentValue === "") return [];
    return [String(currentValue).trim()];
  }
  if (currentValue == null || currentValue === "") return [""];
  return [String(currentValue).trim()];
}

/**
 * For each file slot: upload a pending File if present, otherwise keep the existing URI.
 * Returns a string (single) or string[] (multiple) ready for the JSON payload.
 */
export async function resolveFileFieldPayload(
  currentValue: unknown,
  pendingFiles: (File | null)[] | undefined,
  dataPath: string,
  isMultiple: boolean,
): Promise<string | string[]> {
  const uris = normalizeUriList(currentValue, isMultiple);
  const files = pendingFiles ?? [];
  const slotCount = Math.max(uris.length, files.length, isMultiple ? 0 : 1);
  const resolved: string[] = [];

  for (let index = 0; index < slotCount; index += 1) {
    const pending = files[index] ?? null;
    if (pending) {
      resolved.push(await uploadStoredFile(pending, dataPath));
      continue;
    }
    const existing = uris[index] ?? "";
    if (existing) resolved.push(existing);
  }

  if (isMultiple) return resolved;
  return resolved[0] ?? "";
}

/** @deprecated Prefer resolveFileFieldPayload. */
export async function resolveImageFieldPayload(
  currentValue: unknown,
  pendingFiles: (File | null)[] | undefined,
  dataPath: string,
  isMultiple: boolean,
): Promise<string | string[]> {
  return resolveFileFieldPayload(currentValue, pendingFiles, dataPath, isMultiple);
}

export function storedFileHref(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (!trimmed.includes("/")) return null;
  return `${import.meta.env.VITE_API_URL}/${trimmed}`;
}

export function fileNameFromUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return "";
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

export const DOCUMENT_ACCEPT =
  ".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
