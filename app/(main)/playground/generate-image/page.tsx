'use client';

import { Book, Download, ImageIcon, Lightbulb, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApiResponse } from '@/lib/api/base';
import type { GenerateImageResponseData } from '@/lib/api/types';
import { analytics } from '@/lib/services/analytics';

export default function GenerateImagePage() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
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
    setImage(null);

    // Track image generation request
    analytics.ai.generateImage.submit({
      promptLength: prompt.length,
      promptWords: prompt.trim().split(/\s+/).length,
    });

    try {
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const result: ApiResponse<GenerateImageResponseData> = await response.json();
      console.log('API Response:', result);

      if (result.success && result.data) {
        setImage(result.data.imageUrl);

        // Track successful generation
        analytics.ai.generateImage.success();
      } else {
        const errorMessage = result.error || 'The API call was not successful.';
        setError(errorMessage);

        // Track generation error
        analytics.ai.generateImage.error({
          errorType: 'api_response_error',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMessage);

      // Track generation error
      analytics.ai.generateImage.error({
        errorType: errorMessage.includes('Failed to generate') ? 'api_error' : 'unknown_error',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!image) return;

    // Track image download
    analytics.utils.imageDownload('png');

    const link = document.createElement('a');
    link.href = image;
    link.download = 'generated-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const examplePrompts = [
    'Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme',
    'Design a futuristic cityscape with flying cars and neon lights at sunset',
    'Paint a serene Japanese garden with cherry blossoms and a traditional bridge',
    'Illustrate a magical forest with glowing mushrooms and fairy lights',
    'Generate a cyberpunk street scene with holographic advertisements',
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Generate Images</h1>
          <p className="text-muted-foreground mt-2">
            Use Gemini AI to generate images based on your prompts
          </p>

          {/* Documentation Links */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="https://ai-sdk.dev/cookbook/guides/google-gemini-image-generation">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  analytics.ui.docsLink({ page: 'generate-image', section: 'gemini-guide' })
                }
              >
                <Book className="h-4 w-4 mr-2" />
                Documentation
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>Enter your prompt to generate images</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={promptId}>Prompt</Label>
                  <Textarea
                    id={promptId}
                    placeholder="Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                {/* Example Prompts */}
                <div className="space-y-2">
                  <Label>Example Prompts</Label>
                  <div className="grid gap-1">
                    {examplePrompts.map((example, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="justify-start text-left h-auto py-2 px-3 text-sm text-muted-foreground hover:text-foreground whitespace-normal"
                        onClick={() => {
                          setPrompt(example);
                          // Track example prompt usage
                          analytics.ui.examplePrompt({
                            promptIndex: index,
                            promptType: 'image_generation',
                          });
                        }}
                        type="button"
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Generating...' : 'Generate Image'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Image</CardTitle>
              <CardDescription>AI-generated image will appear here</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[400px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Generating image...</span>
                  </div>
                ) : image ? (
                  <div className="relative group">
                    <img
                      src={image}
                      alt="Generated image"
                      className="w-full rounded-lg shadow-md"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={downloadImage}
                        className="backdrop-blur-sm"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                    <ImageIcon className="h-12 w-12" />
                    <div className="text-center">
                      <p className="font-medium">Generated image will appear here</p>
                      <p className="text-sm">
                        Enter a detailed prompt and click "Generate Image" to get started
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Tips for Better Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>Be specific:</strong> Include details about style, lighting, colors, and
              composition
            </p>
            <p>
              • <strong>Set the scene:</strong> Describe the environment, mood, and atmosphere
            </p>
            <p>
              • <strong>Mention art styles:</strong> Reference specific artistic movements or
              techniques
            </p>
            <p>
              • <strong>Include technical details:</strong> Camera angles, lighting conditions, or
              artistic mediums
            </p>
            <p>
              • <strong>Iterate and refine:</strong> Experiment with different prompt variations for
              best results
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
