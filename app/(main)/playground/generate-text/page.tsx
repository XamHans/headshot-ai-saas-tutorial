'use client';

import { Book, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { analytics } from '@/lib/services/analytics';

export default function GenerateTextPage() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const promptId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    // Track text generation request
    analytics.ai.generateText.submit({
      promptLength: prompt.length,
      promptWords: prompt.trim().split(/\s+/).length,
    });

    try {
      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate text');
      }

      const data = await response.json();
      console.log('Generated text:', JSON.stringify(data));
      setResult(data?.data.text);

      // Track successful generation
      analytics.ai.generateText.success({
        responseLength: data.text?.length || 0,
        responseWords: data.text ? data.text.trim().split(/\s+/).length : 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMessage);

      // Track generation error
      analytics.ai.generateText.error({
        errorType: errorMessage.includes('Failed to generate') ? 'api_error' : 'unknown_error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Generate Text</h1>
          <p className="text-muted-foreground mt-2">Use AI to generate text based on your prompt</p>

          {/* Documentation Links */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/docs/ai-sdk/generate-text/overview">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  analytics.ui.docsLink({
                    page: 'generate-text',
                    section: 'overview',
                  })
                }
              >
                <Book className="h-4 w-4 mr-2" />
                See Documentation
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>Enter your prompt to generate text</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={promptId}>Prompt</Label>
                  <Textarea
                    id={promptId}
                    placeholder="Write a short story about a robot learning to paint..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Generating...' : 'Generate Text'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Text</CardTitle>
              <CardDescription>AI-generated response will appear here</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[300px] p-4 bg-muted/50 rounded-lg">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Generating text...</span>
                  </div>
                ) : result ? (
                  <div className="whitespace-pre-wrap text-sm">{result}</div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Generated text will appear here
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
