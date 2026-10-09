import { FormEvent, useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { isAcceptedImageFile, orgThumbnailUrl } from '@/lib/image-upload';
import { tagsToRows, type TagRow } from '@/lib/entity-tags';
import {
  createOrg,
  fetchOrgDocument,
  updateOrg,
  uploadOrgThumbnail,
} from '@/lib/org-project-api';

import TagRowsEditor from './tag-rows-editor';

export type OrgProjectDialogMode = 'create' | 'edit';

type OrgProjectDialogProps = {
  portfolioId: string;
  mode: OrgProjectDialogMode;
  orgId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function OrgProjectDialog({
  portfolioId,
  mode,
  orgId,
  open,
  onOpenChange,
  onSaved,
}: OrgProjectDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [tagRows, setTagRows] = useState<TagRow[]>([
    { id: crypto.randomUUID(), key: '', value: '' },
  ]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === 'create') {
      setName('');
      setTagRows([{ id: crypto.randomUUID(), key: '', value: '' }]);
      setImageFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!orgId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const doc = await fetchOrgDocument(portfolioId, orgId);
        if (cancelled) return;
        setName(doc.name?.trim() || '');
        setTagRows(tagsToRows(doc.tags));
        setImageFile(null);
        setPreviewUrl(`${orgThumbnailUrl(portfolioId, orgId)}?refresh=${Date.now()}`);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Could not load project',
            description: error instanceof Error ? error.message : undefined,
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, mode, orgId, portfolioId, toast]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isAcceptedImageFile(file)) {
      toast({
        title: 'Invalid image',
        description: 'Please upload a JPEG or PNG file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let targetOrgId = orgId;

      if (mode === 'create') {
        const created = await createOrg(portfolioId, trimmedName, tagRows);
        targetOrgId = created.orgId;
      } else if (targetOrgId) {
        await updateOrg(portfolioId, targetOrgId, trimmedName, tagRows);
      } else {
        throw new Error('Missing organization id');
      }

      if (imageFile && targetOrgId) {
        await uploadOrgThumbnail(portfolioId, targetOrgId, imageFile);
      }

      toast({
        title: mode === 'create' ? 'Project created' : 'Project updated',
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save project',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'create' ? 'Create a new project' : 'Edit project';
  const description =
    mode === 'create'
      ? 'Add a name, optional thumbnail, and tags such as director, studio, and year.'
      : 'Update the name, thumbnail, or tags for this project.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="org-project-name">Name</Label>
              <Input
                id="org-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                disabled={loading || saving}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="org-project-thumbnail">Thumbnail</Label>
              <Input
                id="org-project-thumbnail"
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                onChange={handleImageChange}
                disabled={loading || saving}
              />
              <p className="text-xs text-muted-foreground">
                PNG or JPEG, ideally square, up to 1000×1000.
              </p>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="mt-2 aspect-square max-h-40 w-auto border border-border object-cover"
                />
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagRowsEditor rows={tagRows} onChange={setTagRows} disabled={loading || saving} />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Create project' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
