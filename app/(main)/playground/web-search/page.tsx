'use client';

import { Book, Globe, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { analytics } from '@/lib/services/analytics';

type SearchProvider = 'openai' | 'google';

type SearchSource = {
  id?: string;
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
};

type WebSearchResult = {
  provider: SearchProvider;
  answer: string;
  sources: SearchSource[];
  providerMetadata?: unknown;
};

const providerOptions: { label: string; value: SearchProvider; description: string }[] = [
  {
    label: 'OpenAI Search (web_search_preview)',
    value: 'openai',
    description: 'Fast built-in search that returns citations with summaries.',
  },
  {
    label: 'Google Gemini Search',
    value: 'google',
    description: 'Grounded answers with Google Search citations and metadata.',
  },
];

export default function WebSearchPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<SearchProvider>('openai');
  const [result, setResult] = useState<WebSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSources = result?.sources && result.sources.length > 0;

  const metadataPreview = useMemo(() => {
    if (!result?.providerMetadata) {
      return null;
    }

    const metadata = result.providerMetadata as Record<string, unknown>;
    const entries = Object.entries(metadata);

    if (entries.length === 0) {
      return null;
    }

    return (
      <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-60">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    );
  }, [result?.providerMetadata]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError(null);

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Please enter a search query.');
      return;
    }

    analytics.ai.webSearch.submit({
      queryLength: trimmedQuery.length,
      provider,
    });

    setLoading(true);

    try {
      const response = await fetch('/api/ai/web-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmedQuery, provider }),
      });

      const json = await response.json();

      if (!response.ok || !json?.success) {
        const message = json?.error || 'Failed to complete web search.';
        throw new Error(message);
      }

      const payload = json.data as WebSearchResult;
      setResult(payload);

      analytics.ai.webSearch.success({
        provider,
        resultCount: payload.sources?.length ?? 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error while searching.';
      setError(message);

      analytics.ai.webSearch.error({
        provider,
        errorType: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Web Search</h1>
          <p className="text-muted-foreground mt-2">
            Run grounded searches with OpenAI or Google and inspect the returned citations.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/docs/web-search">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  analytics.ui.docsLink({
                    page: 'web-search',
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
          <Card>
            <CardHeader>
              <CardTitle>Search Query</CardTitle>
              <CardDescription>
                Select a provider and describe what you want to know.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(value: SearchProvider) => setProvider(value)}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Choose a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col gap-1">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="query">Search query</Label>
                  <Textarea
                    id="query"
                    placeholder="What are the most important AI safety updates from the last week?"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Run Web Search
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-h-[420px] flex flex-col">
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    Responses and citations from the selected provider.
                  </CardDescription>
                </div>
                {result && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {result.provider === 'openai' ? 'OpenAI' : 'Google'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Fetching latest results...
                </div>
              ) : result ? (
                <div className="h-full flex flex-col gap-4 overflow-hidden">
                  <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap overflow-auto max-h-48">
                    {result.answer || 'The provider did not return a summary.'}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Sources
                    </h3>
                    {hasSources ? (
                      <ul className="space-y-3">
                        {result.sources.map((source, index) => (
                          <li
                            key={source.id ?? source.url ?? index}
                            className="border rounded-lg p-3"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium">
                                {source.title || source.url || `Result ${index + 1}`}
                              </span>
                              {source.snippet && (
                                <span className="text-xs text-muted-foreground line-clamp-3">
                                  {source.snippet}
                                </span>
                              )}
                              {source.url && (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  {source.url}
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        The provider did not return any explicit sources.
                      </div>
                    )}
                  </div>

                  {metadataPreview && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Provider metadata
                      </h3>
                      {metadataPreview}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-4">
                  Results will appear here after you run a search.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
