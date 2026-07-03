import { and, desc, eq, ilike } from 'drizzle-orm';
import type { ServiceContext } from '@/lib/services/context';
import { getServiceContext } from '@/lib/services';
import type { Result } from '@/lib/result';
import { posts } from '../schema';
import type { CreatePostInput, Post, PostFilters, UpdatePostInput } from '../types';

export class PostService {
  constructor(private ctx: ServiceContext) { }

  private get logger() {
    return this.ctx.logger.child({ service: 'PostService' });
  }

  async createPost(data: CreatePostInput, authorId: string): Promise<Result<Post>> {
    this.logger.info('Creating new post', {
      operation: 'createPost',
      authorId,
      title: data.title,
      published: data.published ?? false,
    });

    try {
      const [post] = await this.ctx.db
        .insert(posts)
        .values({
          ...data,
          authorId,
        })
        .returning();

      this.logger.info('Post created successfully', {
        operation: 'createPost',
        postId: post.id,
        authorId,
        title: data.title,
      });

      return { success: true, data: post };
    } catch (error) {
      this.logger.error('Failed to create post', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          operation: 'createPost',
          authorId,
          title: data.title,
        },
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create post', cause: error },
      };
    }
  }

  async getPostById(id: string): Promise<Result<Post>> {
    this.logger.debug('Retrieving post by ID', {
      operation: 'getPostById',
      postId: id,
    });

    try {
      const [post] = await this.ctx.db.select().from(posts).where(eq(posts.id, id));

      if (!post) {
        this.logger.debug('Post not found', {
          operation: 'getPostById',
          postId: id,
        });
        return {
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        };
      }

      this.logger.debug('Post found', {
        operation: 'getPostById',
        postId: id,
      });

      return { success: true, data: post };
    } catch (error) {
      this.logger.error('Failed to retrieve post by ID', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          operation: 'getPostById',
          postId: id,
        },
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch post', cause: error },
      };
    }
  }

  async updatePost(id: string, data: UpdatePostInput, userId: string): Promise<Result<Post>> {
    this.logger.info('Updating post', {
      operation: 'updatePost',
      postId: id,
      fieldsToUpdate: Object.keys(data),
    });

    // First check ownership
    const postResult = await this.getPostById(id);
    if (!postResult.success) return postResult;

    if (postResult.data.authorId !== userId) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to update this post' },
      };
    }

    try {
      const [post] = await this.ctx.db
        .update(posts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning();

      this.logger.info('Post updated successfully', {
        operation: 'updatePost',
        postId: id,
        fieldsUpdated: Object.keys(data),
      });

      return { success: true, data: post };
    } catch (error) {
      this.logger.error('Failed to update post', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          operation: 'updatePost',
          postId: id,
          fieldsToUpdate: Object.keys(data),
        },
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update post', cause: error },
      };
    }
  }

  async deletePost(id: string, userId: string): Promise<Result<void>> {
    this.logger.info('Deleting post', {
      operation: 'deletePost',
      postId: id,
    });

    // First check ownership
    const postResult = await this.getPostById(id);
    if (!postResult.success) return postResult;

    if (postResult.data.authorId !== userId) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to delete this post' },
      };
    }

    try {
      await this.ctx.db.delete(posts).where(eq(posts.id, id));

      this.logger.info('Post deleted successfully', {
        operation: 'deletePost',
        postId: id,
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to delete post', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          operation: 'deletePost',
          postId: id,
        },
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete post', cause: error },
      };
    }
  }

  async getPosts(filters: PostFilters = {}): Promise<Result<Post[]>> {
    const { limit = 20, offset = 0, search, authorId, includeUnpublished } = filters;

    this.logger.debug('Retrieving posts with filters', {
      operation: 'getPosts',
      limit,
      offset,
      hasSearch: !!search,
      hasAuthorFilter: !!authorId,
      includeUnpublished,
    });

    try {
      const query = this.ctx.db
        .select()
        .from(posts)
        .where(
          and(
            includeUnpublished ? undefined : eq(posts.published, true),
            search ? ilike(posts.title, `%${search}%`) : undefined,
            authorId ? eq(posts.authorId, authorId) : undefined,
          ),
        )
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);

      const result = await query;

      this.logger.debug('Posts retrieved successfully', {
        operation: 'getPosts',
        count: result.length,
        limit,
        offset,
      });

      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to retrieve posts', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          operation: 'getPosts',
          filters,
        },
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve posts', cause: error },
      };
    }
  }

  async getPostsByAuthor(authorId: string, includeUnpublished = false): Promise<Result<Post[]>> {
    this.logger.debug('Retrieving posts by author', {
      operation: 'getPostsByAuthor',
      authorId,
      includeUnpublished,
    });

    try {
      const result = await this.ctx.db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.authorId, authorId),
            includeUnpublished ? undefined : eq(posts.published, true),
          ),
        )
        .orderBy(desc(posts.createdAt));

      this.logger.debug('Author posts retrieved successfully', {
        operation: 'getPostsByAuthor',
        authorId,
        count: result.length,
        includeUnpublished,
      });

      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to retrieve posts by author', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          operation: 'getPostsByAuthor',
          authorId,
          includeUnpublished,
        },
      });
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve posts by author',
          cause: error,
        },
      };
    }
  }
}

/**
 * Factory function to create a PostService instance.
 * Use this in tests to inject test database context.
 */
export function createPostService(ctx: ServiceContext): PostService {
  return new PostService(ctx);
}

/**
 * Singleton instance for production use.
 * Import this directly in API routes.
 */
export const postService = new PostService(getServiceContext());
