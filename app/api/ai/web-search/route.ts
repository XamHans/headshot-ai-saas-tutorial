import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs } from 'ai';
import { withAuth } from '@/lib/api/handlers';
import { parseRequestBody } from '@/lib/validation/parse';
import { withAITelemetry } from '@/lib/ai/telemetry';
import { z } from 'zod';

const searchProviderSchema = z.enum(['openai', 'google']);
type SearchProvider = z.infer<typeof searchProviderSchema>;

const webSearchSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  provider: searchProviderSchema.optional().default('openai'),
});

type WebSearchResponse = {
  provider: SearchProvider;
  answer: string;
  sources: any[];
  providerMetadata?: any;
};

export const POST = withAuth<WebSearchResponse>(async (session, req, context) => {
  const bodyResult = await parseRequestBody(req, webSearchSchema);
  if (!bodyResult.success) return bodyResult;

  const { query, provider } = bodyResult.data;

  const telemetryMetadata = {
    userId: session.user.id,
    sessionId: req.headers.get('x-session-id') || undefined,
    provider,
  };

  const sharedConfig = {
    prompt: query,
    stopWhen: stepCountIs(2),
  };

  try {
    if (provider === 'google') {
      const result = await generateText(
        withAITelemetry(
          {
            ...sharedConfig,
            model: google('gemini-2.5-flash'),
            tools: {
              google_search: google.tools.googleSearch({}),
            },
          },
          {
            functionId: 'web-search',
            metadata: telemetryMetadata,
          },
        ),
      );

      return {
        success: true,
        data: {
          provider,
          answer: result.text,
          sources: result.sources ?? [],
          providerMetadata: result.providerMetadata?.google?.groundingMetadata,
        },
      };
    }

    const result = await generateText(
      withAITelemetry(
        {
          ...sharedConfig,
          model: openai.responses('gpt-4o-mini'),
          tools: {
            web_search_preview: openai.tools.webSearchPreview({}),
          },
        },
        {
          functionId: 'web-search',
          metadata: telemetryMetadata,
        },
      ),
    );

    return {
      success: true,
      data: {
        provider,
        answer: result.text,
        sources: result.sources ?? [],
        providerMetadata: result.providerMetadata,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'Web search failed', cause: error },
    };
  }
});
