import { FormEvent, useEffect, useState } from 'react';
import { ImageUp } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  isAcceptedImageFile,
  notifyUserThumbnailUpdated,
  userThumbnailUrl,
} from '@/lib/image-upload';

interface DialogUserThumbnailProps {
  refreshUp?: () => void;
}

export default function DialogUserThumbnail({ refreshUp }: DialogUserThumbnailProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const handle = sessionStorage.getItem('cu_handle') ?? '';
  const currentThumbnail = handle
    ? userThumbnailUrl(handle, sessionStorage.getItem('cu_thumbnail_v') ?? undefined)
    : null;

  useEffect(() => {
    if (!open) {
      setImage(null);
      setPreview(null);
    }
  }, [open]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!isAcceptedImageFile(file)) {
      toast({
        title: 'Invalid image',
        description: 'Please upload a JPEG or PNG file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!image) {
      return;
    }
    if (!isAcceptedImageFile(image)) {
      toast({
        title: 'Invalid image',
        description: 'Please upload a JPEG or PNG file.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Uploading thumbnail',
      description: image.name,
    });

    try {
      const formData = new FormData();
      formData.append('up_file', image, image.name);
      formData.append('up_file_type', image.type || 'image/jpeg');

      const uploadResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/_files/auth/thumbnails`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.accessToken}`,
          },
          body: formData,
        },
      );

      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        toast({
          title: 'Upload failed',
          description: uploadResult.message || 'Could not upload thumbnail.',
          variant: 'destructive',
        });
        return;
      }

      notifyUserThumbnailUpdated();
      refreshUp?.();
      toast({ title: 'Thumbnail updated' });
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload thumbnail.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Change profile thumbnail"
        >
          <ImageUp className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile thumbnail</DialogTitle>
          <DialogDescription>
            Upload a JPEG or PNG. It will be saved as a 500×500 PNG at{' '}
            <code className="text-xs">auth/thumbnails/{handle || '…'}.png</code>.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="rounded-md border p-6">
          <form onSubmit={handleUpload} className="grid gap-4">
            {currentThumbnail && (
              <img
                src={currentThumbnail}
                alt="Current thumbnail"
                className="h-24 w-24 rounded-full object-cover"
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            {preview && (
              <img src={preview} alt="Preview" className="mt-2 h-24 w-24 rounded-full object-cover" />
            )}
            <Button type="submit" disabled={!image}>
              Upload
            </Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
