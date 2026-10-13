import { useMemo } from 'react';
import { type CodeRow } from '@/domains/review';
import { highlightCode } from '@/lib/code-highlighting';

export function CodeSnippet({
  rows,
  path,
  format,
}: {
  rows: CodeRow[];
  path: string;
  format: 'source' | 'diff';
}) {
  const code = rows.map((row) => row.text).join('\n');
  const tokens = useMemo(() => highlightCode(code, path, format), [code, path, format]);
  return (
    <div className="code-rows" role="region" aria-label="Source code" tabIndex={0}>
      {rows.map((row, index) => (
        <div key={index} className={'code-row ' + row.change}>
          <span className="line-number" aria-hidden="true">
            {row.number ?? ''}
          </span>
          <code>
            {tokens[index]?.map((token, tokenIndex) => (
              <span key={tokenIndex} className={token.className}>
                {token.text}
              </span>
            ))}
          </code>
        </div>
      ))}
    </div>
  );
}
