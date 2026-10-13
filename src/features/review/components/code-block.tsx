import { ChevronDown, Copy, ExternalLink, FileCode2, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  type BlockId,
  type CodeRow,
  type EvidenceBlock,
  type ReviewSession,
  type ReviewStep,
  codeRows,
  sourceUrl,
} from '@/domains/review';
import { loadSourceContext } from '@/integrations/github';
import { copyText } from '@/integrations/files';

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
function CodeRows({ rows }: { rows: CodeRow[] }) {
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
export function EvidenceCode({
  block,
  session,
  onOpen,
}: {
  block: EvidenceBlock & { rows: CodeRow[] };
  session: ReviewSession;
  onOpen: (id: BlockId) => void;
}) {
  const [open, setOpen] = useState(false);
  const source = sourceUrl(session, block.path, block.start);
  function toggle(value: boolean) {
    setOpen(value);
    if (value) onOpen(block.id);
  }
  return (
    <Collapsible open={open} onOpenChange={toggle} className="evidence-code">
      <div className="code-header">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="code-trigger"
            aria-label={(open ? 'Close code ' : 'Open code ') + block.path}
          >
            <ChevronDown className={open ? 'open' : ''} />
            <FileCode2 />
            <span>{block.path}</span>
          </Button>
        </CollapsibleTrigger>
        <span className="source-range">
          {block.start}–{block.end}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy code"
          onClick={() =>
            void copyText(block.code).then(
              () => toast.success('Code copied.'),
              () => toast.error('Could not copy code.'),
            )
          }
        >
          <Copy />
        </Button>
      </div>
      <CollapsibleContent>
        {block.missing ? (
          <p className="missing-code">{block.code}</p>
        ) : (
          <CodeRows rows={block.rows} />
        )}
        <div className="code-footer">
          <span>Unified diff</span>
          {source ? (
            <a href={source} target="_blank" rel="noopener noreferrer">
              View source
              <ExternalLink />
            </a>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
export function ContextCode({ session, step }: { session: ReviewSession; step: ReviewStep }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; source: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setResult({ kind: 'loading' });
    void loadSourceContext(session, step, controller.signal).then(
      (source) => {
        if (!controller.signal.aborted) setResult({ kind: 'ready', source });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Source request failed.',
          });
      },
    );
    return () => controller.abort();
  }, [
    open,
    session.pack.id,
    session.pack.pr.head?.sha,
    session.pack.sources,
    step.context?.path,
    step.context?.start,
    step.context?.end,
  ]);
  if (!step.context) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="context-code">
      <CollapsibleTrigger asChild>
        <Button variant="ghost">
          <ChevronDown />
          <span>Unchanged context: {step.context.path.split('/').at(-1)}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {result.kind === 'ready' ? (
          <CodeRows rows={codeRows(result.source, step.context.start, 'source')} />
        ) : result.kind === 'error' ? (
          <p role="alert">{result.message}</p>
        ) : (
          <p>
            <LoaderCircle className="animate-spin" />
            Loading source…
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
