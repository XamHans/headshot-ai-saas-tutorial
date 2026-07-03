import { HttpResponse, http } from 'msw';

export const handlers = [
  // Mock Gemini API
  http.post('https://generativelanguage.googleapis.com/v1beta/*', () => {
    return HttpResponse.json({
      candidates: [{ content: { parts: [{ text: 'Mock response' }] } }],
    });
  }),

  // Mock R2 Storage
  http.put('https://*.r2.cloudflarestorage.com/*', () => {
    return HttpResponse.text('', { status: 200 });
  }),
];
