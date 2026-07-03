import { FileText, Plus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { PostsTable } from './components/posts-table';

export default async function PostsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
                <p className="text-muted-foreground mt-1">Manage your blog posts and content</p>
              </div>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          </div>
        </div>

        {/* Posts Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>All Posts</CardTitle>
            <CardDescription>View, edit, and manage all your posts in one place</CardDescription>
          </CardHeader>
          <CardContent>
            <PostsTable userId={user.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
