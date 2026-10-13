import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const highlighter = createLowlight({
  bash,
  cpp,
  csharp,
  css,
  go,
  java,
  javascript,
  json,
  php,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
});
const languages = new Map(
  Object.entries({
    sh: 'bash',
    bash: 'bash',
    c: 'cpp',
    h: 'cpp',
    cc: 'cpp',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    css: 'css',
    go: 'go',
    java: 'java',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    php: 'php',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sql: 'sql',
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    html: 'xml',
    xml: 'xml',
    svg: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  }),
);
export type SyntaxToken = { text: string; className?: string };
type SyntaxNode = ReturnType<typeof highlighter.highlight>['children'][number];

function highlightSource(source: string, language: string): SyntaxToken[][] {
  let line: SyntaxToken[] = [];
  const lines: SyntaxToken[][] = [line];
  function visit(node: SyntaxNode, classes = '') {
    if (node.type === 'text') {
      node.value.split('\n').forEach((text, index) => {
        if (index) {
          line = [];
          lines.push(line);
        }
        if (text) line.push({ text, className: classes || undefined });
      });
    } else if (node.type === 'element') {
      const ownClasses = node.properties.className;
      const className = [classes, Array.isArray(ownClasses) ? ownClasses.join(' ') : '']
        .filter(Boolean)
        .join(' ');
      node.children.forEach((child) => visit(child, className));
    }
  }
  highlighter.highlight(language, source).children.forEach((node) => visit(node));
  return lines;
}

function highlightHunk(lines: string[], language: string): SyntaxToken[][] {
  const result = lines.map((text): SyntaxToken[] => [{ text }]);
  // Parse each side separately: removed comments must not color added code.
  for (const side of ['before', 'after']) {
    const included = lines.flatMap((text, index) => {
      if (
        text.startsWith('\\') ||
        (side === 'before' ? text.startsWith('+') : text.startsWith('-'))
      )
        return [];
      return [{ index, text, prefix: /^[ +\-]/.test(text) ? text.charAt(0) : '' }];
    });
    if (!included.length) continue;
    const tokens = highlightSource(
      included.map((row) => row.text.slice(row.prefix.length)).join('\n'),
      language,
    );
    included.forEach((row, index) => {
      if (side === 'before' && !row.text.startsWith('-')) return;
      result[row.index] = [...(row.prefix ? [{ text: row.prefix }] : []), ...(tokens[index] ?? [])];
    });
  }
  return result;
}

/** Presentation tokens only; callers retain ownership of line numbers and diff status. */
export function highlightCode(
  code: string,
  path: string,
  format: 'source' | 'diff',
): SyntaxToken[][] {
  const language = languages.get(path.split('.').at(-1)?.toLowerCase() ?? '');
  const lines = code.split('\n');
  if (!language) return lines.map((text) => [{ text }]);
  if (format === 'source') return highlightSource(code, language);
  const result: SyntaxToken[][] = [];
  let hunk: string[] = [];
  for (const text of lines) {
    if (text.startsWith('@@')) {
      if (hunk.length) result.push(...highlightHunk(hunk, language));
      hunk = [];
      result.push([{ text }]);
    } else hunk.push(text);
  }
  if (hunk.length) result.push(...highlightHunk(hunk, language));
  return result;
}
