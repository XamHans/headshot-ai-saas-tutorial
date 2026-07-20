'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteMyData } from '../hooks/use-delete-my-data';

/**
 * "Delete my data" action with a required confirm step. On confirm it wipes the
 * signed-in user's source photos + generated images from storage and removes
 * their headshot records, then sends them back to the landing page.
 *
 * Destructive and irreversible, so it sits behind an AlertDialog confirmation
 * rather than firing on a single click.
 */
export function DeleteMyData() {
  const router = useRouter();
  const deleteMyData = useDeleteMyData();

  const onConfirm = () => {
    deleteMyData.mutate(undefined, {
      onSuccess: () => {
        toast.success('Your headshot data has been deleted.');
        router.push('/');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="self-start text-destructive hover:text-destructive"
          disabled={deleteMyData.isPending}
          data-testid="delete-my-data-button"
        >
          {deleteMyData.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          )}
          Delete my data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="delete-my-data-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all your headshot data?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your uploaded source photos and every generated headshot
            (including any you purchased) from our storage. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            data-testid="delete-my-data-confirm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
