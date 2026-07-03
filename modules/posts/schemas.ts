import { z } from 'zod';
import { paginationSchema } from '@/lib/validation/schemas/common';

export const getPostsQuerySchema = paginationSchema.extend({
  authorId: z.string().optional(),
  includeUnpublished: z.coerce.boolean().optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  content: z.string().min(1, 'Content required'),
  published: z.boolean().default(false),
});

export const updatePostSchema = createPostSchema.partial();

export type CreatePostSchema = z.infer<typeof createPostSchema>;
export type UpdatePostSchema = z.infer<typeof updatePostSchema>;
