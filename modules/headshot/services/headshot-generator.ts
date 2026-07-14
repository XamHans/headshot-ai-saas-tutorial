import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { withAITelemetry } from '@/lib/ai/telemetry';
import type { Result } from '@/lib/result';

/**
 * Gemini image-to-image model. NOTE: use `gemini-2.5-flash-image` — the
 * `-preview` variant 404s on this account/SDK version.
 */
export const HEADSHOT_MODEL_ID = 'gemini-2.5-flash-image';

export interface GenerateHeadshotImageInput {
  /** Source photo bytes (the user's uploaded face). */
  sourceBuffer: Buffer;
  /** MIME type of the source photo (e.g. `image/jpeg`). */
  sourceMediaType: string;
  /** Full style prompt to send alongside the image. */
  prompt: string;
  /** Telemetry context passed through to the AI SDK. */
  telemetry: { userId: string; jobId: string; styleId: string };
}

export interface GeneratedImage {
  buffer: Buffer;
  mediaType: string;
}

/**
 * Single image-to-image generation against Gemini. Passes the source photo as
 * an `ImagePart` content block alongside the text prompt, then extracts the
 * first `image/*` file from the result.
 *
 * Returns a `Result` — a hard error (network/quota/SDK) or a refusal (no image
 * in the output) both surface as `EXTERNAL_SERVICE_ERROR`, so the caller can
 * treat them uniformly for the retry decision. This function never throws for
 * an expected failure.
 */
export async function generateHeadshotImage(
  input: GenerateHeadshotImageInput,
): Promise<Result<GeneratedImage>> {
  try {
    const result = await generateText(
      withAITelemetry(
        {
          model: google(HEADSHOT_MODEL_ID),
          messages: [
            {
              role: 'user' as const,
              content: [
                {
                  type: 'image' as const,
                  image: input.sourceBuffer,
                  mediaType: input.sourceMediaType,
                },
                { type: 'text' as const, text: input.prompt },
              ],
            },
          ],
        },
        {
          functionId: 'headshot-generate',
          metadata: {
            userId: input.telemetry.userId,
            jobId: input.telemetry.jobId,
            styleId: input.telemetry.styleId,
          },
        },
      ),
    );

    const imageFile = result.files?.find((file) => file.mediaType.startsWith('image/'));
    if (!imageFile) {
      // The model returned no image — treat a refusal like any hard failure so
      // the service's retry logic engages.
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'The image model did not return an image.',
        },
      };
    }

    return {
      success: true,
      data: {
        buffer: Buffer.from(imageFile.uint8Array),
        mediaType: imageFile.mediaType,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'The image model failed to generate.',
        cause: error,
      },
    };
  }
}
