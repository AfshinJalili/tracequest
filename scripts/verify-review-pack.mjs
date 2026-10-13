import { readFile, writeFile } from 'node:fs/promises';
import { loadReviewDomain } from './review-domain.mjs';
import { readReviewSnapshot } from './review-repository.mjs';
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
  const domain = await loadReviewDomain();
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
  const snapshot = readReviewSnapshot(pack, repo);
  domain.verifySourceSnapshot(pack, snapshot);
  if (args.includes('--stamp')) {
    const output = raw.pack ? { ...raw, pack } : pack;
    await writeFile(packPath, JSON.stringify(output, null, 2) + '\n');
  }
  const missing = pack.blocks.filter((block) => block.missing).length;
  process.stdout.write(
    `Source checked at ${snapshot.head}: ${pack.files.length} files, ${pack.blocks.length} blocks, ${pack.unmapped.length} unmapped, ${missing} unavailable patches.\nSemantic review and an app walkthrough are still required.\n`,
  );
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
