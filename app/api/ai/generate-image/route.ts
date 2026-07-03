import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { withAuth } from '@/lib/api/handlers';
import { parseRequestBody } from '@/lib/validation/parse';
import { withAITelemetry } from '@/lib/ai/telemetry';
import { z } from 'zod';

const generateImageSchema = z.object({
  prompt: z.string().min(1),
});

export const POST = withAuth(async (session, req, context) => {
  const bodyResult = await parseRequestBody(req, generateImageSchema);
  if (!bodyResult.success) return bodyResult;

  const { prompt } = bodyResult.data;

  // We are creating a logger inside the handler if needed, but withAuth signature 
  // currently doesn't pass a logger. We can use console or rely on telemetry.
  // Ideally, if logging is critical, we should inject it or adapt withAuth.

  try {
    const result = await generateText(
      withAITelemetry(
        {
          model: google('gemini-2.5-flash-image-preview'),
          prompt,
        },
        {
          functionId: 'generate-image',
          metadata: {
            userId: session.user.id,
            sessionId: req.headers.get('x-session-id') || undefined, // Fallback if needed
          },
        },
      ),
    );

    // Find the first image file
    let imageUrl: string | null = null;

    if (result.files) {
      const imageFile = result.files.find((file) => file.mediaType.startsWith('image/'));
      if (imageFile) {
        // Convert Uint8Array to base64 data URL
        const base64 = Buffer.from(imageFile.uint8Array).toString('base64');
        imageUrl = `data:${imageFile.mediaType};base64,${base64}`;
      }
    }

    if (!imageUrl) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'No image was generated' },
      };
    }

    return {
      success: true,
      data: { imageUrl },
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'Failed to generate image', cause: error },
    };
  }
});
