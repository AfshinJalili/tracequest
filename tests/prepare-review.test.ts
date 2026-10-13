import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { buildPack, validatePack } from '@/domains/review';
import { storyBaseSource, storyPack, storySources } from './story-fixture';

it('prepares repository context and verifies a story with genuinely executed examples', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'tracequest-stories-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  const output = path.join(repo, 'review workspace');
  const evidencePath = path.join(repo, 'evidence.json');
  const prepare = (...extra: string[]) =>
    execFileSync(
      process.execPath,
      [
        path.resolve('scripts/prepare-review.mjs'),
        '--pack',
        evidencePath,
        '--repo',
        repo,
        '--out',
        output,
        ...extra,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  try {
    git('init', '-q');
    git('config', 'user.name', 'Story fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    mkdirSync(path.join(repo, 'docs'));
    for (const [filename, text] of Object.entries(storySources))
      writeFileSync(path.join(repo, filename), filename === 'service.mjs' ? storyBaseSource : text);
    git('add', '.');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    // Model a base branch tip beyond the comparison ancestor.
    const tip = git(
      'commit-tree',
      git('rev-parse', `${base}^{tree}`),
      '-p',
      base,
      '-m',
      'base branch advanced',
    );
    writeFileSync(path.join(repo, 'service.mjs'), storySources['service.mjs']);
    git('add', '.');
    git('commit', '-qm', 'reject invalid quantities');
    const head = git('rev-parse', 'HEAD');
    const diff = git('diff', base, head, '--', 'service.mjs');
    const evidence = buildPack(
      { title: 'Reject invalid reservation quantities', base: { sha: tip }, head: { sha: head } },
      [
        {
          filename: 'service.mjs',
          patch: diff.slice(diff.indexOf('@@')),
          additions: 1,
          deletions: 0,
        },
      ],
    );
    writeFileSync(evidencePath, JSON.stringify(evidence));
    writeFileSync(
      path.join(repo, 'api.mjs'),
      'Uncommitted caller text must not become pinned evidence.\n',
    );
    expect(prepare()).toContain(`Prepared 1 changed files and 1 blocks at ${head}`);
    const prepared = validatePack(
      JSON.parse(readFileSync(path.join(output, 'evidence.json'), 'utf8')),
    );
    expect(prepared.pr.base?.sha).toBe(base);
    expect(prepared.blocks).toEqual(evidence.blocks);
    expect(prepared.flows).toEqual([]);
    const inventory = JSON.parse(readFileSync(path.join(output, 'repository.json'), 'utf8'));
    expect(inventory.documentationCandidates).toContain('docs/reservation.md');
    expect(inventory.trackedPaths).toContain('api.mjs');
    expect(inventory.changedPaths).toEqual(['service.mjs']);
    expect(
      JSON.parse(readFileSync(path.join(output, 'review-schema.json'), 'utf8')),
    ).toHaveProperty('properties.flows');
    expect(readFileSync(path.join(output, 'brief.md'), 'utf8')).toContain(
      'authorship.method="story-v1"',
    );
    writeFileSync(path.join(output, 'discovery.md'), 'Author research must survive a rerun.');
    expect(() => prepare()).toThrow(/EEXIST/);
    expect(readFileSync(path.join(output, 'discovery.md'), 'utf8')).toBe(
      'Author research must survive a rerun.',
    );

    writeFileSync(path.join(repo, 'api.mjs'), storySources['api.mjs']);
    const code =
      'import { reserveForUser } from "./api.mjs"; console.log(JSON.stringify(reserveForUser({userId:"42"},{ownerId:"42",quantity:2}))); try { reserveForUser({userId:"42"},{ownerId:"42",quantity:0}); } catch (error) { console.log(error.message); }';
    const observed = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd: repo,
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    const pack = storyPack(prepared);
    const proposed = {
      ...pack,
      flows: pack.flows.map((flow) => ({
        ...flow,
        story: {
          ...flow.story,
          examples: flow.story?.examples.map((example, index) => ({
            ...example,
            basis: 'executed',
            output: observed[index],
            preconditions:
              'Local Git fixture. Caller user 42 matches owner 42; no database is needed.',
            run: {
              command: `node --input-type=module -e ${JSON.stringify(code)}`,
              environment: 'Local Node.js fixture at the pinned commit',
            },
          })),
        },
      })),
      authorship: {
        ...pack.authorship,
        sourceFingerprint: 'pending',
        verificationNotes: `Executed the local caller. Observed ${observed.join('; ')}. UI layout was not inspected.`,
      },
    };
    const authoredPath = path.join(output, 'review.json');
    writeFileSync(authoredPath, JSON.stringify(proposed));
    expect(
      execFileSync(
        process.execPath,
        [
          path.resolve('scripts/verify-review-pack.mjs'),
          '--pack',
          authoredPath,
          '--repo',
          repo,
          '--stamp',
        ],
        { encoding: 'utf8', stdio: 'pipe' },
      ),
    ).toContain(`Source checked at ${head}`);
    const authored = validatePack(JSON.parse(readFileSync(authoredPath, 'utf8')));
    expect(authored.flows[0]?.story?.examples.map((example) => example.output)).toEqual([
      '{"ownerId":"42","quantity":2}',
      'INVALID_QUANTITY',
    ]);
    expect(authored.authorship?.method).toBe('story-v1');
    expect(git('rev-parse', 'HEAD')).toBe(head);
    writeFileSync(
      evidencePath,
      JSON.stringify({ ...evidence, pr: { ...evidence.pr, head: { sha: base } } }),
    );
    expect(() => prepare()).toThrow(/HEAD differs/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}, 30_000);
