import { type ReviewPack } from './schema';
export type SourceSnapshot = {
  head: string;
  base: string;
  changedPaths: string[];
  files: Record<string, { base: string | null; head: string | null }>;
  context: Record<string, string>;
};
function lines(source: string | null): string[] {
  if (source === null || source === '') return [];
  const result = source.replace(/\r\n/g, '\n').split('\n');
  if (result.at(-1) === '') result.pop();
  return result;
}
export function verifySourceSnapshot(pack: ReviewPack, snapshot: SourceSnapshot): void {
  if (
    !pack.pr.head ||
    !pack.pr.base ||
    pack.pr.head.sha !== snapshot.head ||
    pack.pr.base.sha !== snapshot.base
  )
    throw new Error('Repository base/head commits do not match the review pack.');
  const included = new Set(pack.files.map((file) => file.filename));
  if (
    included.size !== snapshot.changedPaths.length ||
    snapshot.changedPaths.some((path) => !included.has(path))
  )
    throw new Error('Review omits or adds changed files from the pinned commits.');
  for (const [path, text] of Object.entries(pack.sources))
    if (snapshot.context[path] !== text)
      throw new Error('Pinned context differs from repository source: ' + path);
  for (const file of pack.files) {
    if (!file.patch) continue;
    const source = snapshot.files[file.filename];
    if (!source) throw new Error('Missing repository source: ' + file.filename);
    const old = lines(source.base),
      expected = lines(source.head),
      rebuilt: string[] = [];
    let cursor = 0,
      oldCount = 0,
      newCount = 0,
      consumedOld = 0,
      consumedNew = 0,
      inHunk = false;
    const finish = () => {
      if (inHunk && (oldCount !== consumedOld || newCount !== consumedNew))
        throw new Error('Hunk line counts do not match: ' + file.filename);
    };
    for (const line of file.patch.replace(/\r\n/g, '\n').split('\n')) {
      const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (header) {
        finish();
        oldCount = Number(header[2] ?? 1);
        newCount = Number(header[4] ?? 1);
        const start = oldCount === 0 ? Number(header[1]) : Math.max(0, Number(header[1]) - 1);
        if (start < cursor || start > old.length)
          throw new Error('Invalid source range: ' + file.filename);
        rebuilt.push(...old.slice(cursor, start));
        cursor = start;
        const newStart = newCount === 0 ? Number(header[3]) : Math.max(0, Number(header[3]) - 1);
        if (newStart !== rebuilt.length)
          throw new Error('New source range does not match: ' + file.filename);
        consumedOld = 0;
        consumedNew = 0;
        inHunk = true;
      } else if (inHunk && (line.startsWith(' ') || line.startsWith('-'))) {
        const text = line.slice(1);
        if (old[cursor] !== text)
          throw new Error('Base source differs from patch: ' + file.filename);
        cursor++;
        consumedOld++;
        if (line.startsWith(' ')) {
          rebuilt.push(text);
          consumedNew++;
        }
      } else if (inHunk && line.startsWith('+')) {
        rebuilt.push(line.slice(1));
        consumedNew++;
      } else if (line && !line.startsWith('\\'))
        throw new Error('Invalid patch line: ' + file.filename);
    }
    finish();
    rebuilt.push(...old.slice(cursor));
    if (!inHunk || JSON.stringify(rebuilt) !== JSON.stringify(expected))
      throw new Error('Patch is incomplete or differs from pinned head source: ' + file.filename);
  }
}
