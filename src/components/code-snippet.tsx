import { type CodeRow } from '@/domains/review';

function HighlightedLine({ text }: { text: string }) {
  const tokens = text.split(
    /(\/\/.*$|'[^']*'|"[^"]*"|\b(?:if|return|const|await|let|new|undefined|async|throw|try|catch|export|class|private)\b|\b(?:Session|User|Order|StockLevel|RequestContext)\b)/g,
  );
  return (
    <>
      {tokens.map((token, index) => (
        <span
          key={index}
          className={
            token.startsWith('//')
              ? 'syntax-comment'
              : token.startsWith("'") || token.startsWith('"')
                ? 'syntax-string'
                : /^(if|return|const|await|let|new|undefined|async|throw|try|catch|export|class|private)$/.test(
                      token,
                    )
                  ? 'syntax-keyword'
                  : /^(Session|User|Order|StockLevel|RequestContext)$/.test(token)
                    ? 'syntax-type'
                    : undefined
          }
        >
          {token}
        </span>
      ))}
    </>
  );
}
export function CodeSnippet({ rows }: { rows: CodeRow[] }) {
  return (
    <div className="code-rows" role="region" aria-label="Source code" tabIndex={0}>
      {rows.map((row, index) => (
        <div key={index} className={'code-row ' + row.change}>
          <span className="line-number" aria-hidden="true">
            {row.number ?? ''}
          </span>
          <code>
            <HighlightedLine text={row.text} />
          </code>
        </div>
      ))}
    </div>
  );
}
