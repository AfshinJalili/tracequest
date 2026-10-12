import {
  blockIdSchema,
  MAX_BLOCK_LINES,
  MAX_IMPORT_BYTES,
  type ChangedFile,
  type EvidenceBlock,
  type ReviewStep,
} from './schema';

export function hash(text: string): string {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}
export function classifyEvidence(path: string): EvidenceBlock['kind'] {
  if (/test|spec|e2e/i.test(path)) return 'Proof';
  if (isModelDefinition(path) || /migration/i.test(path)) return 'Data';
  if (/resolver|controller|route|handler/i.test(path)) return 'Entry';
  if (/connection|repository|store|cache|queue/i.test(path)) return 'Boundary';
  return 'Logic';
}
function evidenceTitle(code: string, path: string): string {
  const test = code.match(/(?:it|test)\(['"`]([^'"`]+)/);
  if (test?.[1]) return test[1];
  const declaration = code.match(/(?:async\s+)?(?:function\s+)?([a-zA-Z_$][\w$]*)\([^;\n]*\).*\{/);
  return (
    declaration?.[1] ??
    path
      .split('/')
      .at(-1)
      ?.replace(/\.[^.]+$/, '') ??
    path
  );
}
export function parseEvidence(files: ChangedFile[]): EvidenceBlock[] {
  const blocks: EvidenceBlock[] = [];
  for (const file of files) {
    if (!file.patch) {
      blocks.push({
        id: blockIdSchema.parse(hash(file.filename + ':missing')),
        path: file.filename,
        title: 'Missing patch',
        code: 'Patch unavailable. Import the full diff to review this file.',
        start: 1,
        end: 1,
        kind: classifyEvidence(file.filename),
        missing: true,
      });
      continue;
    }
    let newLine = 0,
      chunk: string[] = [],
      start = 0,
      index = 0;
    const flush = () => {
      if (!chunk.length) return;
      const code = chunk.join('\n');
      blocks.push({
        id: blockIdSchema.parse(hash(file.filename + ':' + index++ + ':' + code)),
        path: file.filename,
        title: evidenceTitle(code, file.filename),
        code,
        start,
        end: Math.max(start, newLine - 1),
        kind: classifyEvidence(file.filename),
        missing: false,
      });
      chunk = [];
      start = newLine;
    };
    for (const line of file.patch.split('\n')) {
      const header = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (header) {
        flush();
        newLine = Number(header[2]);
        start = newLine;
        chunk.push(line);
        continue;
      }
      if (chunk.length >= MAX_BLOCK_LINES && !line.startsWith('\\')) flush();
      if (!chunk.length) start = newLine;
      chunk.push(line);
      if (!line.startsWith('-') && !line.startsWith('\\')) newLine++;
    }
    flush();
  }
  return blocks;
}
export function parseUnifiedDiff(diff: string): ChangedFile[] {
  if (new TextEncoder().encode(diff).length > MAX_IMPORT_BYTES)
    throw new Error('Use a diff smaller than 3 MB.');
  const files: ChangedFile[] = [];
  let file: ChangedFile | undefined;
  for (const line of diff.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (match?.[2]) {
      file = { filename: match[2], patch: '', additions: 0, deletions: 0 };
      files.push(file);
    } else if (file && (file.patch || line.startsWith('@@'))) {
      file.patch = (file.patch ? file.patch + '\n' : '') + line;
      if (line.startsWith('+')) file.additions++;
      if (line.startsWith('-')) file.deletions++;
    }
  }
  if (!files.length) throw new Error('No unified diff found. Export with git diff base...HEAD.');
  return files;
}
export type CodeRow = {
  number: number | null;
  text: string;
  change: 'addition' | 'deletion' | 'header' | 'context';
};
export function codeRows(
  code: string,
  start: number,
  format: 'diff' | 'source' = 'diff',
): CodeRow[] {
  let lineNumber = start;
  return code.split('\n').map((text) => {
    const change: CodeRow['change'] =
      format === 'source'
        ? 'context'
        : text.startsWith('@@')
          ? 'header'
          : text.startsWith('+')
            ? 'addition'
            : text.startsWith('-')
              ? 'deletion'
              : 'context';
    const number = change === 'header' || change === 'deletion' ? null : lineNumber++;
    return { number, text, change };
  });
}
export function evidenceForStep(blocks: EvidenceBlock[], step: ReviewStep): EvidenceBlock[] {
  const selected = new Set(step.blockIds);
  return blocks.filter((block) => selected.has(block.id));
}

export function isModelDefinition(path: string): boolean {
  return /entity|model|schema/i.test(path);
}
