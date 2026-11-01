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
  if (IMAGE_MIME_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
}

/** Stored profile thumbnails are this square. Matches the server resize. */
export const THUMBNAIL_EDGE = 500;

/**
 * Largest source file we will decode in the browser.
 * API Gateway returns 413 once a multipart body passes about 6MB, so uploads
 * are resized to THUMBNAIL_EDGE before they are posted.
 */
export const THUMBNAIL_SOURCE_LIMIT_BYTES = 40 * 1024 * 1024;

export type CoverCrop = { sx: number; sy: number; sw: number; sh: number };

/** Center cover-crop, same framing as the server's square fit. */
export function coverCropSourceRect(
  width: number,
  height: number,
  edge: number = THUMBNAIL_EDGE,
): CoverCrop {
  if (!(width > 0) || !(height > 0) || !(edge > 0)) {
    throw new Error('Invalid image size');
  }
  const scale = Math.max(edge / width, edge / height);
  const sw = edge / scale;
  const sh = edge / scale;
  return {
    sx: (width - sw) / 2,
    sy: (height - sh) / 2,
    sw,
    sh,
  };
}

/**
 * Downscale a JPEG/PNG to a square PNG small enough for the files API.
 * The raw camera file is what API Gateway rejects with 413.
 */
export async function prepareThumbnailFile(file: File): Promise<File> {
  if (!isAcceptedImageFile(file)) {
    throw new Error('Please upload a JPEG or PNG file.');
  }
  if (file.size > THUMBNAIL_SOURCE_LIMIT_BYTES) {
    throw new Error('This image is too large. Choose a photo under 40 MB.');
  }

  const bitmap = await loadOrientedBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_EDGE;
    canvas.height = THUMBNAIL_EDGE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not prepare image.');
    }
    const crop = coverCropSourceRect(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      THUMBNAIL_EDGE,
      THUMBNAIL_EDGE,
    );
    const blob = await canvasToPngBlob(canvas);
    const stem = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
    return new File([blob], `${stem}.png`, { type: 'image/png' });
  } finally {
    bitmap.close();
  }
}

async function loadOrientedBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    try {
      return await createImageBitmap(file);
    } catch {
      throw error instanceof Error ? error : new Error('Could not read image.');
    }
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not prepare image.'));
    }, 'image/png');
  });
}

/** Public URL for a user's profile thumbnail (500×500 PNG in S3). */
export function userThumbnailUrl(handle: string, refresh?: string | number): string {
  const trimmed = handle.trim();
  if (!trimmed) return '';
  const base = `${import.meta.env.VITE_API_URL}/_files/auth/thumbnails/${trimmed}.png`;
  if (refresh == null || refresh === '') return base;
  return `${base}?refresh=${encodeURIComponent(String(refresh))}`;
}

export function notifyUserThumbnailUpdated(): void {
  const version = String(Date.now());
  sessionStorage.setItem('cu_thumbnail_v', version);
  window.dispatchEvent(new Event('user-thumbnail-updated'));
}

export function userInitialsFromSession(): string {
  const first = (sessionStorage.getItem('cu_first') || '').trim();
  const last = (sessionStorage.getItem('cu_last') || '').trim();
  const fromNames = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (fromNames.trim()) return fromNames;
  const handle = sessionStorage.getItem('cu_handle') || '';
  return handle.substring(0, 2).toUpperCase();
}

/** Same org thumbnail URL used on the home page (`/_files/.../_thumbnails/{orgId}.png`). */
export function orgThumbnailUrl(portfolioId: string, orgId: string): string {
  return `${import.meta.env.VITE_API_URL}/_files/${portfolioId}/${orgId}/_thumbnails/${orgId}.png`;
}

const warmedImageUrls = new Set<string>();

/** Preload an image URL once so later <img> mounts reuse the browser cache. */
export function warmImageCache(url: string): void {
  const trimmed = url.trim();
  if (!trimmed || warmedImageUrls.has(trimmed)) return;
  warmedImageUrls.add(trimmed);
  const img = new Image();
  img.decoding = 'async';
  img.src = trimmed;
}

type TreePortfolios = Record<
  string,
  {
    portfolio_id: string;
    orgs?: Record<string, PortfolioOrgRef>;
  }
>;

/** Warm org thumbnails for the account-menu portfolio collage (max 4 orgs each). */
export function warmPortfolioThumbnailCache(portfolios: TreePortfolios | undefined): void {
  if (!portfolios) return;
  for (const portfolio of Object.values(portfolios)) {
    const portfolioId = portfolio.portfolio_id;
    for (const org of activePortfolioOrgs(portfolio.orgs).slice(0, 4)) {
      warmImageCache(orgThumbnailUrl(portfolioId, org.org_id));
    }
  }
}

export type PortfolioOrgRef = {
  org_id: string;
  handle?: string;
  name?: string;
  active?: boolean;
};

/** Active orgs for a portfolio, matching the home page filter. */
export function activePortfolioOrgs(
  orgs: Record<string, PortfolioOrgRef> | undefined,
): PortfolioOrgRef[] {
  if (!orgs) return [];
  return Object.values(orgs).filter((org) => org.active === true);
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

function bearerToken(): string {
  const token = sessionStorage.getItem("accessToken") || sessionStorage.accessToken;
  if (!token) {
    throw new Error("Session expired. Please reload.");
  }
  return token;
}

/**
 * GET a stored `_files/...` object with the session Bearer token.
 * The API authorizes then 302s to a short-lived S3 URL; `redirect: "follow"`
 * resolves the bytes.
 */
export async function fetchStoredFile(uri: string): Promise<Blob> {
  const url = storedFileHref(uri);
  if (!url) {
    throw new Error("Invalid file URI");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken()}`,
    },
    redirect: "follow",
  });

  if (!response.ok) {
    let message = `Failed to fetch file (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string" && body.message) message = body.message;
      else if (typeof body?.error === "string" && body.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  return response.blob();
}

export function fileNameFromUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return "";
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

export const DOCUMENT_ACCEPT =
  ".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
