import { rowsToTags, type TagRow } from '@/lib/entity-tags';
import { isAcceptedImageFile } from '@/lib/image-upload';

const apiBase = () => import.meta.env.VITE_API_URL as string;

export function orgIdFromCreateResponse(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const steps = (body as { document?: unknown[] }).document;
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const step = steps[0] as { document?: { _id?: string } };
  return step.document?._id?.trim() || null;
}

export async function createOrg(
  portfolioId: string,
  name: string,
  tagRows: TagRow[],
): Promise<{ orgId: string }> {
  const tags = rowsToTags(tagRows);
  const response = await fetch(`${apiBase()}/_auth/orgs/${portfolioId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionStorage.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim(),
      ...(Object.keys(tags).length > 0 ? { tags } : {}),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Could not create organization');
  }
  const orgId = orgIdFromCreateResponse(body);
  if (!orgId) {
    throw new Error('Organization was created but no id was returned');
  }
  return { orgId };
}

export async function updateOrg(
  portfolioId: string,
  orgId: string,
  name: string,
  tagRows: TagRow[],
): Promise<void> {
  const response = await fetch(`${apiBase()}/_auth/portfolios/${portfolioId}/orgs/${orgId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionStorage.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim(),
      tags: rowsToTags(tagRows),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Could not update organization');
  }
}

export async function fetchOrgDocument(portfolioId: string, orgId: string) {
  const response = await fetch(`${apiBase()}/_auth/orgs/${portfolioId}-${orgId}`, {
    headers: {
      Authorization: `Bearer ${sessionStorage.accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Could not load organization');
  }
  return response.json() as Promise<{ name?: string; tags?: Record<string, string | string[]> }>;
}

export async function uploadOrgThumbnail(
  portfolioId: string,
  orgId: string,
  image: File,
): Promise<void> {
  if (!isAcceptedImageFile(image)) {
    throw new Error('Please upload a JPEG or PNG file');
  }

  const formData = new FormData();
  formData.append('up_file', new Blob([image], { type: image.type }), image.name);
  formData.append('up_file_type', image.type);
  formData.append('up_file_override', orgId);

  const response = await fetch(`${apiBase()}/_files/${portfolioId}/${orgId}/_thumbnails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionStorage.accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Could not upload thumbnail');
  }
}
