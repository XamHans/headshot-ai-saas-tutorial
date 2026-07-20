import { withAuth } from '@/lib/api/handlers';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { DeleteUserDataResult } from '@/modules/headshot/types';

/**
 * POST /api/headshot/delete-my-data — user-initiated "delete my data".
 *
 * `withAuth` supplies the session; deletion is scoped strictly to
 * `session.user.id`, never a client-supplied id, so a user can only ever delete
 * their own headshot data. The confirm step lives in the UI.
 */
export const POST = withAuth<DeleteUserDataResult>(async (session) => {
  return headshotService.deleteUserData(session.user.id);
});
