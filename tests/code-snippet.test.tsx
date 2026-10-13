import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeSnippet } from '@/components/code-snippet';
import { highlightCode } from '@/lib/code-highlighting';
import { buildPack, codeRows, reviewView, startReview } from '@/domains/review';
import { ModelsDialog } from '@/features/review/components/models-dialog';

describe('source highlighting', () => {
  it.each([
    ['service.ts', 'export async function reserve() { return "stock"; }'],
    ['service.go', 'package stock\nfunc reserve() string { return "stock" }'],
    ['service.py', 'def reserve():\n    return "stock"'],
    ['query.sql', "SELECT id FROM stock WHERE status = 'active';"],
    ['config.json', '{"stock": 42, "enabled": true}'],
    ['config.yml', 'stock: 42\nenabled: true'],
    ['Service.java', 'public class Stock { private int quantity = 42; }'],
    ['service.rs', 'fn reserve() -> bool { true }'],
  ])('highlights %s with its grammar while preserving the source', (path, code) => {
    const tokens = highlightCode(code, path, 'source');
    expect(tokens.map((line) => line.map((token) => token.text).join('')).join('\n')).toBe(code);
    expect(tokens.flat().some((token) => token.className?.includes('hljs-'))).toBe(true);
  });

  it('carries multiline comment state across lines and ends it at the closing delimiter', () => {
    const tokens = highlightCode(
      '/* first\nreturn is still a comment\n*/\nreturn 42;',
      'service.ts',
      'source',
    );
    expect(
      tokens[1]
        ?.filter((token) => token.className?.includes('hljs-comment'))
        .map((token) => token.text)
        .join(''),
    ).toBe('return is still a comment');
    expect(tokens[3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'return', className: 'hljs-keyword' }),
        expect.objectContaining({ text: '42', className: 'hljs-number' }),
      ]),
    );
  });

  it('parses each diff side and hunk independently without losing markers or whitespace', () => {
    const code =
      '@@ -1,2 +1,2 @@\n-/* removed\n-still removed */\n+const label = "雪";\n+\treturn label;\n@@ -80 +80 @@\n-/* omitted continuation\n+return 42;\n\\ No newline at end of file';
    const tokens = highlightCode(code, 'service.ts', 'diff');
    expect(tokens.map((line) => line.map((token) => token.text).join('')).join('\n')).toBe(code);
    expect(tokens[0]).toEqual([{ text: '@@ -1,2 +1,2 @@' }]);
    expect(tokens[2]?.some((token) => token.className === 'hljs-comment')).toBe(true);
    expect(
      tokens[3]?.some((token) => token.text === 'const' && token.className === 'hljs-keyword'),
    ).toBe(true);
    expect(
      tokens[7]?.some((token) => token.text === 'return' && token.className === 'hljs-keyword'),
    ).toBe(true);
    expect(tokens[8]).toEqual([{ text: '\\ No newline at end of file' }]);
  });

  it('keeps unknown languages plain, including prototype-like extensions and empty lines', () => {
    const code = '+const value = "<script>";\n\n';
    for (const path of ['README.md', 'file.constructor', 'file.toString', 'LICENSE']) {
      expect(highlightCode(code, path, 'source')).toEqual(
        code.split('\n').map((text) => [{ text }]),
      );
    }
  });

  it('renders literal markup safely and preserves source prefixes and line numbers', () => {
    const code = '+value;\nconst html = "<img src=x onerror=alert(1)>";\n\n';
    const { container } = render(
      <CodeSnippet rows={codeRows(code, 12, 'source')} path="service.ts" format="source" />,
    );
    const region = screen.getByRole('region', { name: 'Source code' });
    expect([...region.querySelectorAll('code')].map((node) => node.textContent).join('\n')).toBe(
      code,
    );
    expect([...region.querySelectorAll('.line-number')].map((node) => node.textContent)).toEqual([
      '12',
      '13',
      '14',
      '15',
    ]);
    expect(container.querySelector('img, script')).toBeNull();
    expect(container.querySelector('.hljs-string')).toHaveTextContent(
      '<img src=x onerror=alert(1)>',
    );
    expect(container.querySelector('.addition')).toBeNull();
  });

  it('shows highlighted model definitions through the same source renderer', async () => {
    const code = 'export class Stock {\n  quantity = 42;\n}\n';
    const pack = buildPack({ title: 'Stock model' }, [
      {
        filename: 'models/stock.ts',
        patch: '@@ -0,0 +1 @@\n+export class Stock {}',
        additions: 1,
        deletions: 0,
      },
    ]);
    const view = reviewView(
      startReview({ ...pack, sources: { 'models/stock.ts': code } }),
      new Set(),
    );
    const user = userEvent.setup();
    render(<ModelsDialog view={view} open onOpenChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'stock.ts' }));
    const dialog = screen.getByRole('dialog', { name: 'stock.ts' });
    expect(within(dialog).getByRole('region', { name: 'Source code' })).toBeVisible();
    expect(dialog.querySelector('.hljs-keyword')).toHaveTextContent('export');
    expect(dialog.querySelector('.hljs-number')).toHaveTextContent('42');
  });
});
