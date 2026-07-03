import { beforeEach, describe, expect, it } from 'vitest';
import { getTestDb } from '@/tests/utils/test-database';
import { createLogger } from '@/lib/logger';
import { createPostService } from '../services/post.service';
import type { PostService } from '../services/post.service';
import type { ServiceContext } from '@/lib/services/context';

describe('PostService', () => {
  let postService: PostService;

  beforeEach(() => {
    const ctx: ServiceContext = {
      db: getTestDb(),
      logger: createLogger(), // No context - let services set their own
    };
    postService = createPostService(ctx);
  });

  describe('createPost', () => {
    it('should create a new post', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content',
        published: false,
      };
      const authorId = 'test-author-id';

      const result = await postService.createPost(postData, authorId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          title: postData.title,
          content: postData.content,
          published: postData.published,
          authorId: authorId,
        });
        expect(result.data.id).toBeDefined();
        expect(result.data.createdAt).toBeDefined();
        expect(result.data.updatedAt).toBeDefined();
      }
    });

    it('should create a published post', async () => {
      const postData = {
        title: 'Published Test Post',
        content: 'This is a published test post',
        published: true,
      };
      const authorId = 'test-author-id';

      const result = await postService.createPost(postData, authorId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.published).toBe(true);
        expect(result.data.title).toBe(postData.title);
        expect(result.data.authorId).toBe(authorId);
      }
    });
  });

  describe('getPostById', () => {
    it('should find post by id', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content',
        published: true,
      };
      const authorId = 'test-author-id';

      const createResult = await postService.createPost(postData, authorId);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const findResult = await postService.getPostById(createResult.data.id);

      expect(findResult.success).toBe(true);
      if (findResult.success) {
        expect(findResult.data).toMatchObject({
          id: createResult.data.id,
          title: postData.title,
          content: postData.content,
          published: postData.published,
          authorId: authorId,
        });
      }
    });

    it('should return error for non-existent post', async () => {
      const result = await postService.getPostById('non-existent-id');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('POST_NOT_FOUND');
      }
    });
  });

  describe('updatePost', () => {
    it('should update post title and content', async () => {
      const postData = {
        title: 'Original Title',
        content: 'Original content',
        published: false,
      };
      const authorId = 'test-author-id';

      const createResult = await postService.createPost(postData, authorId);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const updateResult = await postService.updatePost(createResult.data.id, updateData, authorId);

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data).toMatchObject({
          id: createResult.data.id,
          title: updateData.title,
          content: updateData.content,
          published: false,
          authorId: authorId,
        });
        expect(updateResult.data.updatedAt).not.toEqual(createResult.data.updatedAt);
      }
    });

    it('should update only published status', async () => {
      const postData = {
        title: 'Test Post',
        content: 'Test content',
        published: false,
      };
      const authorId = 'test-author-id';

      const createResult = await postService.createPost(postData, authorId);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const updateData = {
        published: true,
      };

      const updateResult = await postService.updatePost(createResult.data.id, updateData, authorId);

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data).toMatchObject({
          id: createResult.data.id,
          title: postData.title,
          content: postData.content,
          published: true,
          authorId: authorId,
        });
      }
    });

    it('should return error when updating post owned by another user', async () => {
      const postData = {
        title: 'Test Post',
        content: 'Test content',
        published: false,
      };
      const authorId = 'test-author-id';
      const otherUserId = 'other-user-id';

      const createResult = await postService.createPost(postData, authorId);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const updateResult = await postService.updatePost(
        createResult.data.id,
        { title: 'Hacked Title' },
        otherUserId,
      );

      expect(updateResult.success).toBe(false);
      if (!updateResult.success) {
        expect(updateResult.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      const postData = {
        title: 'Post to Delete',
        content: 'This post will be deleted',
        published: true,
      };
      const authorId = 'test-author-id';

      const createResult = await postService.createPost(postData, authorId);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const deleteResult = await postService.deletePost(createResult.data.id, authorId);
      expect(deleteResult.success).toBe(true);

      const findResult = await postService.getPostById(createResult.data.id);
      expect(findResult.success).toBe(false);
      if (!findResult.success) {
        expect(findResult.error.code).toBe('POST_NOT_FOUND');
      }
    });

    it('should return error when deleting post owned by another user', async () => {
      const postData = {
        title: 'Test Post',
        content: 'Test content',
        published: false,
      };
      const authorId = 'test-author-id';
      const otherUserId = 'other-user-id';

      const createResult = await postService.createPost(postData, authorId);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const deleteResult = await postService.deletePost(createResult.data.id, otherUserId);

      expect(deleteResult.success).toBe(false);
      if (!deleteResult.success) {
        expect(deleteResult.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('getPosts', () => {
    beforeEach(async () => {
      // Create some test posts
      const authorId = 'test-author-id';

      await postService.createPost(
        {
          title: 'Published Post 1',
          content: 'Content 1',
          published: true,
        },
        authorId,
      );

      await postService.createPost(
        {
          title: 'Published Post 2',
          content: 'Content 2',
          published: true,
        },
        authorId,
      );

      await postService.createPost(
        {
          title: 'Draft Post',
          content: 'Draft content',
          published: false,
        },
        authorId,
      );
    });

    it('should return only published posts by default', async () => {
      const result = await postService.getPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        result.data.forEach((post) => {
          expect(post.published).toBe(true);
        });
      }
    });

    it('should respect limit parameter', async () => {
      const result = await postService.getPosts({ limit: 1 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].published).toBe(true);
      }
    });

    it('should respect offset parameter', async () => {
      const result = await postService.getPosts({ limit: 1, offset: 1 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].published).toBe(true);
      }
    });

    it('should filter by search term', async () => {
      const result = await postService.getPosts({ search: 'Post 1' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('Published Post 1');
      }
    });

    it('should filter by author id', async () => {
      const otherAuthorId = 'other-author-id';

      await postService.createPost(
        {
          title: 'Other Author Post',
          content: 'Content by other author',
          published: true,
        },
        otherAuthorId,
      );

      const result = await postService.getPosts({ authorId: otherAuthorId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('Other Author Post');
        expect(result.data[0].authorId).toBe(otherAuthorId);
      }
    });
  });

  describe('getPostsByAuthor', () => {
    it('should return posts by specific author', async () => {
      const authorId = 'test-author-id';
      const otherAuthorId = 'other-author-id';

      await postService.createPost(
        {
          title: 'Author 1 Post 1',
          content: 'Content 1',
          published: true,
        },
        authorId,
      );

      await postService.createPost(
        {
          title: 'Author 1 Post 2',
          content: 'Content 2',
          published: false,
        },
        authorId,
      );

      await postService.createPost(
        {
          title: 'Author 2 Post',
          content: 'Content by author 2',
          published: true,
        },
        otherAuthorId,
      );

      const result = await postService.getPostsByAuthor(authorId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1); // Only published post
        expect(result.data[0].title).toBe('Author 1 Post 1');
        expect(result.data[0].authorId).toBe(authorId);
      }
    });

    it('should include unpublished posts when specified', async () => {
      const authorId = 'test-author-id';

      await postService.createPost(
        {
          title: 'Published Post',
          content: 'Published content',
          published: true,
        },
        authorId,
      );

      await postService.createPost(
        {
          title: 'Draft Post',
          content: 'Draft content',
          published: false,
        },
        authorId,
      );

      const result = await postService.getPostsByAuthor(authorId, true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data.some((p) => p.published)).toBe(true);
        expect(result.data.some((p) => !p.published)).toBe(true);
      }
    });
  });
});
