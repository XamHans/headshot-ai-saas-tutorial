'use client';

import { Dropzone } from '@/components/ui/dropzone';

export default function FileUploadPlayground() {
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">File Upload Playground</h1>
          <p className="text-lg text-muted-foreground">
            Test file upload functionality with drag & drop interface and R2 storage integration
          </p>
        </div>

        {/* Main Upload Area */}
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop files or click to select. Files are uploaded to Cloudflare R2 storage.
            </p>
            <Dropzone
              maxFiles={5}
              maxSize={10 * 1024 * 1024} // 10MB
              accept={{
                'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
                'application/pdf': ['.pdf'],
                'text/plain': ['.txt'],
                'application/json': ['.json'],
                'text/csv': ['.csv'],
              }}
              onFilesChange={() => {
                // Files selected callback - not needed for demo
              }}
            />
          </div>

          {/* Features List */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-3">Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Drag & drop file upload</li>
                <li>• File type validation</li>
                <li>• Size limit enforcement (10MB)</li>
                <li>• Image previews</li>
                <li>• Upload progress tracking</li>
                <li>• Multiple file support</li>
                <li>• Error handling & validation</li>
              </ul>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-3">Supported Files</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Images: PNG, JPG, JPEG, GIF, WebP</li>
                <li>• Documents: PDF</li>
                <li>• Text files: TXT, JSON, CSV</li>
                <li>• Maximum size: 10MB per file</li>
                <li>• Maximum files: 5 at once</li>
              </ul>
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-3">Technical Implementation</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Frontend</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• React Dropzone</li>
                  <li>• TypeScript</li>
                  <li>• Tailwind CSS</li>
                  <li>• Shadcn/ui components</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Backend</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Next.js API routes</li>
                  <li>• File validation</li>
                  <li>• Security checks</li>
                  <li>• Error handling</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Storage</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Cloudflare R2</li>
                  <li>• AWS SDK v3</li>
                  <li>• Secure file naming</li>
                  <li>• Direct uploads</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
