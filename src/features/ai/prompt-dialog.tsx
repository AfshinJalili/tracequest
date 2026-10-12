import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { copyText, downloadText } from '@/integrations/files';
import { type ReviewPack, validateMappedFlows } from '@/domains/review';
export type PromptRequest =
  { kind: 'question'; text: string } | { kind: 'mapping'; text: string; pack: ReviewPack };
export function PromptDialog({
  request,
  onClose,
  onApply,
}: {
  request: PromptRequest | null;
  onClose: () => void;
  onApply: (pack: ReviewPack) => void;
}) {
  const [error, setError] = useState('');
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError('');
          onClose();
        }
      }}
    >
      <DialogContent className="prompt-dialog">
        <DialogHeader>
          <DialogTitle>Copy context</DialogTitle>
          <DialogDescription>
            {request?.kind === 'mapping'
              ? 'Send this prompt to ChatGPT or your coding agent, then paste the JSON map below.'
              : 'Send this step and its code to ChatGPT or your coding agent.'}
          </DialogDescription>
        </DialogHeader>
        <Textarea value={request?.text ?? ''} readOnly rows={7} aria-label="Review context" />
        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={() => downloadText('tracequest-prompt.txt', request?.text ?? '')}
          >
            Download
          </Button>
          <Button
            onClick={() =>
              void copyText(request?.text ?? '').then(
                () => toast.success('Copied.'),
                () => toast.error('Clipboard unavailable. Download the prompt instead.'),
              )
            }
          >
            Copy
          </Button>
        </div>
        {request?.kind === 'mapping' ? (
          <form
            className="dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const data = new FormData(event.currentTarget),
                  raw = data.get('map');
                if (typeof raw !== 'string') throw new Error('Paste the map JSON.');
                const value: unknown = JSON.parse(
                  raw
                    .trim()
                    .replace(/^```(?:json)?\s*/, '')
                    .replace(/\s*```$/, ''),
                );
                onApply({
                  ...request.pack,
                  flows: validateMappedFlows(value, request.pack.blocks),
                  mapping: 'ai',
                });
                onClose();
                toast.success('Flows updated.');
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Invalid map.');
              }
            }}
          >
            <label htmlFor="map-json">Flow map JSON</label>
            <Textarea id="map-json" name="map" rows={5} required />
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit">Apply map</Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
