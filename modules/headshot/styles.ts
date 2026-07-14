/**
 * Approved v1 style presets for headshot generation. Each preset carries a
 * user-facing label + description (for the style picker UI) and a Gemini
 * image-to-image prompt template.
 *
 * Every prompt is explicit that this is an identity-preserving *edit* of the
 * person in the supplied photo — not a synthesis of a new person — so the
 * output keeps the real face while restyling background / attire / lighting.
 */

export interface HeadshotStyle {
  id: string;
  label: string;
  /** Short, user-facing description shown on the picker card. */
  description: string;
  /** Style-specific direction appended to the shared base prompt. */
  prompt: string;
}

/** Shared instruction prefix — identity preservation + framing. */
const BASE_PROMPT =
  'Create a photorealistic, professional headshot by editing the person in the supplied photo. ' +
  "Preserve the person's actual face, identity, facial features, skin tone, hair and expression " +
  'exactly — this is an edit of the real person, not a new or different person. Head-and-shoulders ' +
  'framing, sharp focus on the face, high quality. ';

export const HEADSHOT_STYLES: readonly HeadshotStyle[] = [
  {
    id: 'corporate-linkedin',
    label: 'Corporate / LinkedIn',
    description: 'Neutral studio backdrop, business attire, soft even lighting.',
    prompt: `${BASE_PROMPT}Style: a neutral gray studio backdrop, business professional attire (suit or blazer), soft even studio lighting suitable for a LinkedIn profile.`,
  },
  {
    id: 'business-casual',
    label: 'Business Casual',
    description: 'Outdoor daylight, smart-casual attire, softly blurred background.',
    prompt: `${BASE_PROMPT}Style: an outdoor setting with natural daylight, smart-casual attire, a softly blurred natural background.`,
  },
  {
    id: 'studio-bw',
    label: 'Studio B&W',
    description: 'Classic black-and-white studio portrait, dramatic soft lighting.',
    prompt: `${BASE_PROMPT}Style: a classic black-and-white studio portrait, dramatic soft lighting, formal attire.`,
  },
  {
    id: 'creative-tech',
    label: 'Creative / Tech',
    description: 'Soft blue/purple gradient backdrop, modern casual-professional attire.',
    prompt: `${BASE_PROMPT}Style: a soft colored gradient studio background (blue and purple tones), modern casual-professional attire.`,
  },
  {
    id: 'executive',
    label: 'Executive',
    description: 'Dark tailored suit, moody dramatic side lighting, dark backdrop.',
    prompt: `${BASE_PROMPT}Style: a dark tailored suit, moody dramatic side lighting, a dark neutral backdrop.`,
  },
  {
    id: 'approachable',
    label: 'Approachable',
    description: 'Bright warm office, blurred bokeh, warm lighting, genuine smile.',
    prompt: `${BASE_PROMPT}Style: a bright warm office setting, a blurred bokeh background, warm friendly lighting, smart-casual attire, a genuine warm smile.`,
  },
] as const;

/** The pre-selected default style shown highlighted in the picker. */
export const DEFAULT_STYLE_ID = 'corporate-linkedin';

/** Number of variant previews generated per set. */
export const HEADSHOT_VARIANT_COUNT = 3;

const STYLE_BY_ID = new Map(HEADSHOT_STYLES.map((s) => [s.id, s]));

export function getHeadshotStyle(styleId: string): HeadshotStyle | undefined {
  return STYLE_BY_ID.get(styleId);
}

export function isValidStyleId(styleId: string): boolean {
  return STYLE_BY_ID.has(styleId);
}
