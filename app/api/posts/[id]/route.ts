import { withAuth, withHandler } from '@/lib/api/handlers';
import { parseRequestBody, parseWith } from '@/lib/validation/parse';
import { updatePostSchema } from '@/modules/posts/schemas';
import { postService } from '@/modules/posts/services/post.service';
import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().min(1),
});

// GET /api/posts/[id] - Get single post (public)
export const GET = withHandler(async (req, ctx) => {
  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  return postService.getPostById(idResult.data.id);
});

// PUT /api/posts/[id] - Update post (requires authentication + ownership)
export const PUT = withAuth(async (session, req, ctx) => {
  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  const bodyResult = await parseRequestBody(req, updatePostSchema);
  if (!bodyResult.success) return bodyResult;

  return postService.updatePost(idResult.data.id, bodyResult.data, session.user.id);
});

// DELETE /api/posts/[id] - Delete post (requires authentication + ownership)
export const DELETE = withAuth(async (session, req, ctx) => {
  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  return postService.deletePost(idResult.data.id, session.user.id);
});
