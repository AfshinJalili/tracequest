import { expect, it, vi } from 'vitest';
import demo from '../public/demo.json';
import { importPublicPr } from '@/integrations/github';
import { askModel } from '@/integrations/model';
import { startReview, validatePack } from '@/domains/review';
it('imports a public PR through all file pages and validates completeness', async () => {
  const fetch = vi.fn(
    async (url: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          String(url).includes('/files')
            ? demo.files
            : { ...demo.pr, changed_files: demo.files.length },
        ),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const pack = await importPublicPr('https://github.com/vendurehq/vendure/pull/5259');
  expect(pack.blocks).toHaveLength(14);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(pack.mapping).toBe('candidate');
});
it('reports a GitHub rate limit instead of returning an empty review', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 403 })),
  );
  await expect(importPublicPr('https://github.com/vendurehq/vendure/pull/5259')).rejects.toThrow(
    /rate limit/,
  );
});
it('sends only the selected step’s evidence with the model request', async () => {
  const fetch = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Check the transaction boundary.' } }] }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const session = startReview(validatePack(demo)),
    answer = await askModel(
      { endpoint: 'https://api.example.invalid/v1', model: 'review-model', key: 'temporary-key' },
      session,
      session.pack.flows[0].steps[0],
      'Which transaction?',
    );
  expect(answer).toBe('Check the transaction boundary.');
  const call = fetch.mock.calls[0];
  expect(call).toBeDefined();
  const request = fetch.mock.calls[0]?.[1];
  if (!request) throw new Error('Request missing');
  expect(String(request.body)).toContain('EVIDENCE');
  expect(String(request.body)).not.toContain('stock-level.service.ts');
  expect(localStorage.length).toBe(0);
});
