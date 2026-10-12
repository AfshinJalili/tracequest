import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function argument(name) {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
}
const packPath = argument('--pack'),
  repo = argument('--repo');
if (!packPath || !repo) {
  process.stderr.write(
    'Usage: npm run verify:pack -- --pack review.json --repo /path/to/repo [--stamp]\n',
  );
  process.exit(1);
}
try {
  // Bundle the actual domain contract in memory; there is no second validator or dev server.
  const bundle = await build({
    root,
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: false,
      lib: { entry: path.join(root, 'src/domains/review/index.ts'), formats: ['es'] },
    },
  });
  const chunk = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(
    (item) => item.type === 'chunk',
  );
  if (!chunk) throw new Error('Could not load the review domain.');
  const domain = await import(
    'data:text/javascript;base64,' + Buffer.from(chunk.code).toString('base64')
  );
  const raw = JSON.parse(await readFile(packPath, 'utf8'));
  let pack = domain.packSchema.parse(raw.pack ?? raw);
  if (pack.mapping !== 'authored')
    throw new Error('Only agent-authored review packs can be verified.');
  if (args.includes('--stamp')) {
    if (!pack.authorship) throw new Error('Include authorship metadata before verification.');
    pack = {
      ...pack,
      authorship: { ...pack.authorship, sourceFingerprint: domain.sourceFingerprint(pack) },
    };
  }
  pack = domain.validatePack(pack);
  const git = (...parameters) =>
    execFileSync('git', ['-C', repo, ...parameters], { encoding: 'utf8', maxBuffer: 50_000_000 });
  const head = git('rev-parse', 'HEAD').trim();
  const base = git('rev-parse', pack.pr.base.sha).trim();
  const changedPaths = git('diff', '--name-only', '-z', base, head).split('\0').filter(Boolean);
  const readSource = (sha, filename) => {
    if (!git('ls-tree', '-z', sha, '--', filename)) return null;
    return git('show', `${sha}:${filename}`);
  };
  const files = Object.fromEntries(
    pack.files
      .filter((file) => file.patch)
      .map((file) => [
        file.filename,
        {
          base: readSource(base, file.previous_filename ?? file.filename),
          head: readSource(head, file.filename),
        },
      ]),
  );
  const context = Object.fromEntries(
    Object.keys(pack.sources).map((filename) => [filename, readSource(head, filename)]),
  );
  domain.verifySourceSnapshot(pack, { head, base, changedPaths, files, context });
  if (args.includes('--stamp')) {
    const output = raw.pack ? { ...raw, pack } : pack;
    await writeFile(packPath, JSON.stringify(output, null, 2) + '\n');
  }
  const missing = pack.blocks.filter((block) => block.missing).length;
  process.stdout.write(
    `Source checked at ${head}: ${pack.files.length} files, ${pack.blocks.length} blocks, ${pack.unmapped.length} unmapped, ${missing} unavailable patches.\nSemantic review and an app walkthrough are still required.\n`,
  );
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
