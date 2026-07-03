import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withAuth } from '@/lib/api/handlers';
import { parseRequestBody } from '@/lib/validation/parse';
import { withAITelemetry } from '@/lib/ai/telemetry';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const generateTextSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(8000, 'Prompt too long').trim(),
});

type GenerateTextResponse = {
  text: string;
};

export const POST = withAuth<GenerateTextResponse>(async (session, req, context) => {
  const bodyResult = await parseRequestBody(req, generateTextSchema);
  if (!bodyResult.success) return bodyResult;

  const { prompt } = bodyResult.data;

  const requestLogger = logger.child({
    operation: 'generate-text',
    userId: session.user.id,
    promptLength: prompt.length,
  });

  requestLogger.info('Text generation requested');

  try {
    const { text } = await generateText(
      withAITelemetry(
        {
          model: openai('gpt-3.5-turbo'),
          prompt,
        },
        {
          functionId: 'generate-text',
          metadata: {
            userId: session.user.id,
            sessionId: req.headers.get('x-session-id') || undefined,
            model: 'gpt-3.5-turbo',
            promptLength: prompt.length,
          },
        },
      ),
    );

    if (!text || text.trim().length === 0) {
      requestLogger.error('Empty text received from AI');
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'No text was generated' },
      };
    }

    requestLogger.info('Text generated', {
      textLength: text.length,
    });

    return { success: true, data: { text } };
  } catch (error) {
    requestLogger.error('Text generation failed', { error });
    return {
      success: false,
      error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'Failed to generate text', cause: error },
    };
  }
});
