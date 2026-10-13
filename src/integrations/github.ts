import { z } from 'zod';
import { requestSignal } from './request-signal';
import {
  buildPack,
  fileSchema,
  prSchema,
  type ReviewPack,
  type ReviewSession,
  type ReviewStep,
} from '@/domains/review';

function publicPullRequest(url: string): URL {
  const value = new URL(url),
    match = value.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)\/?$/);
  if (value.protocol !== 'https:' || value.hostname !== 'github.com' || !match)
    throw new Error('Use a public github.com/owner/repo/pull/123 URL.');
  return new URL(`https://api.github.com/repos/${match[1]}/${match[2]}/pulls/${match[3]}`);
}
async function githubJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: requestSignal(signal, 25000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? 'GitHub rate limit reached. Import a diff instead.'
        : response.status === 404
          ? 'PR is not public. Import its local diff.'
          : 'GitHub returned ' + response.status,
    );
  return response.json();
}
export async function importPublicPr(url: string, signal?: AbortSignal): Promise<ReviewPack> {
  const endpoint = publicPullRequest(url),
    pr = prSchema.parse(await githubJson(endpoint, signal));
  if ((pr.changed_files ?? 0) > 3000)
    throw new Error('GitHub limits the file list to 3,000 files. Import the complete diff.');
  const files = [];
  for (let page = 1; page <= 30; page++) {
    const next = new URL(endpoint + '/files');
    next.searchParams.set('per_page', '100');
    next.searchParams.set('page', String(page));
    const batch = z.array(fileSchema).parse(await githubJson(next, signal));
    files.push(...batch);
    if (batch.length < 100) break;
  }
  if (pr.changed_files !== undefined && files.length !== pr.changed_files)
    throw new Error('Incomplete PR file list. Import the complete diff.');
  return buildPack(pr, files);
}
export async function loadSourceContext(
  session: ReviewSession,
  step: ReviewStep,
  signal?: AbortSignal,
): Promise<string> {
  const context = step.context;
  if (!context) throw new Error('This step has no source context.');
  let source = session.pack.sources[context.path];
  if (!source) {
    const prUrl = session.pack.pr.html_url,
      sha = session.pack.pr.head?.sha;
    if (!prUrl || !sha) throw new Error('No pinned source is available.');
    const segments = new URL(prUrl).pathname.split('/');
    const url = new URL(
      `https://api.github.com/repos/${segments[1]}/${segments[2]}/contents/${context.path.split('/').map(encodeURIComponent).join('/')}`,
    );
    url.searchParams.set('ref', sha);
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github.raw+json' },
      signal: requestSignal(signal, 20000),
    });
    if (!response.ok) throw new Error('Source request failed (' + response.status + ').');
    source = await response.text();
  }
  return source
    .split('\n')
    .slice(context.start - 1, context.end)
    .join('\n');
}
