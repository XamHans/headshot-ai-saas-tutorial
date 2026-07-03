export interface CreatePostInput {
  title: string;
  content: string;
  published?: boolean;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  published?: boolean;
}

export interface PostFilters {
  limit?: number;
  offset?: number;
  search?: string;
  authorId?: string;
  includeUnpublished?: boolean;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
