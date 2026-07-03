'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCreatePost, useUpdatePost } from '@/app/(main)/posts/hooks/use-posts';
import type { Post } from '@/modules/posts/types';

interface PostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  post?: Post;
}

export function PostFormDialog({
  open,
  onOpenChange,
  onSuccess,
  userId,
  post,
}: PostFormDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [published, setPublished] = useState(false);
  // removed useToast

  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();

  const isEditing = !!post;
  const loading = createMutation.isPending || updateMutation.isPending;

  // ... useEffect

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error('Validation Error', {
        description: 'Title and content are required',
      });
      return;
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      published,
    };

    const handleSuccess = () => {
      onSuccess();
      onOpenChange(false);
    };

    const handleError = (error: Error) => {
      toast.error('Error', {
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} post`,
      });
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: post.id, ...data },
        { onSuccess: handleSuccess, onError: handleError },
      );
    } else {
      createMutation.mutate(data, { onSuccess: handleSuccess, onError: handleError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Post' : 'Create New Post'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your post details below.'
              : 'Fill in the details to create a new post.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter post title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post content..."
              rows={8}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="published" checked={published} onCheckedChange={setPublished} />
            <Label htmlFor="published">{published ? 'Published' : 'Draft'}</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditing
                  ? 'Updating...'
                  : 'Creating...'
                : isEditing
                  ? 'Update Post'
                  : 'Create Post'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
