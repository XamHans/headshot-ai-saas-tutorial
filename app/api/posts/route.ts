import { withAuth, withHandler } from '@/lib/api/handlers';
import { parseRequestBody, parseSearchParams } from '@/lib/validation/parse';
import { createPostSchema, getPostsQuerySchema } from '@/modules/posts/schemas';
import { postService } from '@/modules/posts/services/post.service';

// GET /api/posts - List posts (public)
export const GET = withHandler(async (req) => {
  const paramsResult = parseSearchParams(req.url, getPostsQuerySchema);
  if (!paramsResult.success) return paramsResult;

  return postService.getPosts(paramsResult.data);
});

// POST /api/posts - Create post (requires authentication)
export const POST = withAuth(async (session, req) => {
  const bodyResult = await parseRequestBody(req, createPostSchema);
  if (!bodyResult.success) return bodyResult;

  return postService.createPost(bodyResult.data, session.user.id);
});
