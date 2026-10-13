import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadReviewDomain } from './review-domain.mjs';
import { pinReviewCommits, readReviewSnapshot, repositoryGit } from './review-repository.mjs';

const args = process.argv.slice(2);
function argument(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
const packPath = argument('--pack'),
  repoPath = argument('--repo'),
  outputPath = argument('--out');
if (!packPath || !repoPath || !outputPath) {
  process.stderr.write(
    'Usage: npm run prepare:review -- --pack evidence.json --repo /path/to/repository --out /path/to/new-workspace [--base main]\n',
  );
  process.exit(1);
}
try {
  const repo = path.resolve(repoPath),
    output = path.resolve(outputPath);
  const domain = await loadReviewDomain();
  const raw = JSON.parse(await readFile(packPath, 'utf8'));
  const input = domain.validatePack(raw.pack ?? raw);
  const commits = pinReviewCommits(input, repo, argument('--base'));
  const pack = domain.validatePack({
    ...input,
    pr: { ...input.pr, ...commits },
    mapping: 'evidence',
    flows: [],
    unmapped: [],
    authorship: undefined,
  });
  const snapshot = readReviewSnapshot(pack, repo);
  domain.verifySourceSnapshot(pack, snapshot);
  const git = repositoryGit(repo);
  const trackedPaths = git('ls-tree', '-r', '--name-only', '-z', snapshot.head)
    .split('\0')
    .filter(Boolean);
  const docs = trackedPaths.filter((filename) =>
    /(^|\/)(AGENTS\.md|RULES\.md|README[^/]*|docs\/.*|[^/]*\.(md|mdx|rst))$/i.test(filename),
  );
  const inventory = {
    repository: repo,
    base: snapshot.base,
    head: snapshot.head,
    changedPaths: snapshot.changedPaths,
    documentationCandidates: docs,
    trackedPaths,
  };
  const brief = `${domain.AUTHORING_INSTRUCTIONS}\n## This workspace\n\nRepository path: ${JSON.stringify(repo)}\nComparison base: ${snapshot.base}\nHead: ${snapshot.head}\n\nRead repository.json for tracked paths and documentation candidates, then evidence.json for the immutable source evidence and PR description. These are inventories, not a call graph. Read committed Git source from the repository and write your research in discovery.md before authoring review.json. Follow relevant references as far as needed. The target working tree may differ from HEAD; do not confuse uncommitted files with this review. review-schema.json is generated from the application schema. Keep workspace files private if the PR is private. Do not modify evidence.json.\n`;
  const discovery =
    '# Discovery notes\n\n## Candidate stories\n\nRecord actor, trigger, before/after behavior, terminal result, entry point, and unknowns for each candidate.\n\n## Traces\n\nFor each story, record source ranges, incoming values, decisions, reads/writes, next calls, asynchronous consumers, and failure branches.\n\n## Scope decisions\n\nExplain which candidates became flows, which were combined, and which evidence remains unmapped.\n\n## Checks and gaps\n\nRecord actual commands and results, unrun checks, absent context, and whether examples were traced or executed.\n';
  const files = {
    'brief.md': brief,
    'discovery.md': discovery,
    'evidence.json': JSON.stringify(pack, null, 2) + '\n',
    'repository.json': JSON.stringify(inventory, null, 2) + '\n',
    'review-schema.json': JSON.stringify(domain.reviewPackJsonSchema(), null, 2) + '\n',
  };
  // A fresh directory protects authored work from accidental regeneration.
  await mkdir(output);
  for (const [filename, content] of Object.entries(files))
    await writeFile(path.join(output, filename), content, { flag: 'wx' });
  process.stdout.write(
    `Prepared ${pack.files.length} changed files and ${pack.blocks.length} blocks at ${snapshot.head}.\nGive the agent ${path.join(output, 'brief.md')} and repository access. No flows were invented and no source was changed.\n`,
  );
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
