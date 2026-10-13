import { z } from 'zod';
import { requestSignal } from './request-signal';
import { REVIEW_SYSTEM, stepContext, type ReviewSession, type ReviewStep } from '@/domains/review';

export const modelSettingsSchema = z.object({
  endpoint: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  }, 'Use an HTTPS base URL without credentials or a query.'),
  model: z.string().trim().min(1),
  key: z.string().trim().min(1),
});
export type ModelSettings = z.infer<typeof modelSettingsSchema>;
const resultSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});
const errorSchema = z.object({ error: z.object({ message: z.string() }) });
async function complete(
  settings: ModelSettings,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  signal?: AbortSignal,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(settings.endpoint.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.key },
      body: JSON.stringify({ model: settings.model, messages }),
      signal: requestSignal(signal, 90000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new Error('The model request timed out. Try again.', { cause: error });
    throw new Error(
      'Could not reach the model. Check endpoint, network and provider CORS support.',
      { cause: error },
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      response.ok
        ? 'The provider returned an unreadable answer.'
        : 'Provider returned ' + response.status,
      { cause: error },
    );
  }
  if (!response.ok) {
    const providerError = errorSchema.safeParse(data);
    throw new Error(
      providerError.success
        ? providerError.data.error.message
        : 'Provider returned ' + response.status,
    );
  }
  const result = resultSchema.parse(data),
    choice = result.choices[0];
  if (!choice) throw new Error('The model returned no answer.');
  return choice.message.content;
}
export async function askModel(
  settings: ModelSettings,
  session: ReviewSession,
  step: ReviewStep,
  question: string,
  signal?: AbortSignal,
): Promise<string> {
  return complete(
    settings,
    [
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: stepContext(session, step, question) },
    ],
    signal,
  );
}
