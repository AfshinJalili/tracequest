import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { buildPack, validatePack } from '@/domains/review';

it('verifies an authored pack against a real checkout before stamping it', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'tracequest-source-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  const verify = (...args: string[]) =>
    execFileSync(
      process.execPath,
      [
        path.resolve('scripts/verify-review-pack.mjs'),
        '--pack',
        path.join(repo, 'review.json'),
        '--repo',
        repo,
        ...args,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  try {
    git('init', '-q');
    git('config', 'user.name', 'Source verification fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    writeFileSync(path.join(repo, 'AGENTS.md'), 'Require request ownership before reserving.\n');
    writeFileSync(path.join(repo, 'caller.js'), "import { reserve } from './service.js';\n");
    writeFileSync(
      path.join(repo, 'service.js'),
      'export function reserve(user) { return user.id; }\n',
    );
    git('add', '.');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    const source =
      'export function reserve(user) {\n  if (!user.id) throw new Error("Missing owner");\n  return user.id;\n}\n';
    writeFileSync(path.join(repo, 'service.js'), source);
    git('add', '.');
    git('commit', '-qm', 'require owner');
    const head = git('rev-parse', 'HEAD');
    const diff = git('diff', base, head, '--', 'service.js');
    const evidence = buildPack(
      { title: 'Require reservation owner', base: { sha: base }, head: { sha: head } },
      [
        {
          filename: 'service.js',
          patch: diff.slice(diff.indexOf('@@')),
          additions: 4,
          deletions: 1,
        },
      ],
    );
    const proposed = {
      ...evidence,
      mapping: 'authored',
      sources: {
        'AGENTS.md': readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'),
        'caller.js': readFileSync(path.join(repo, 'caller.js'), 'utf8'),
        'service.js': source,
      },
      flows: [
        {
          id: 'reservation',
          title: 'Reserve for a known owner',
          summary: 'Reject a missing owner before returning the reservation owner.',
          actor: 'Service caller',
          trigger: 'reserve(user)',
          authorization:
            'This fixture checks presence only; authentication is outside this function.',
          steps: [
            {
              id: 'owner-check',
              title: 'Validate the owner',
              kind: 'Logic',
              summary: 'A missing ID throws before the return.',
              input: 'user.id',
              output: 'Owner ID or an error',
              question: 'Does the caller establish ownership before this call?',
              blockIds: evidence.blocks.map((block) => block.id),
              context: { path: 'service.js', start: 1, end: 4 },
            },
          ],
        },
      ],
      authorship: {
        author: 'Test fixture',
        sourceFingerprint: 'pending',
        contextReviewed: ['AGENTS.md', 'caller.js', 'service.js'],
        missingContext: ['No auth or execution tests in this synthetic checkout'],
        verificationNotes: 'Verifies source integrity, not review quality.',
      },
    };
    const file = path.join(repo, 'review.json');
    writeFileSync(file, JSON.stringify(proposed));
    expect(verify('--stamp')).toContain(`Source checked at ${head}`);
    const stamped: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const pack = validatePack(stamped);
    expect(pack.authorship?.sourceFingerprint).not.toBe('pending');
    expect(verify()).toContain('Semantic review and an app walkthrough are still required.');

    writeFileSync(file, JSON.stringify({ ...pack, pr: { ...pack.pr, head: { sha: base } } }));
    expect(() => verify('--stamp')).toThrow(/commits do not match/);
    const rejected = readFileSync(file, 'utf8');
    expect(rejected).toContain(base);
    writeFileSync(
      file,
      JSON.stringify({ ...pack, sources: { ...pack.sources, 'caller.js': 'stale' } }),
    );
    expect(() => verify('--stamp')).toThrow(/context differs/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}, 30_000);
