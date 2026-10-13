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
import { type ReviewPack, validatePack } from '@/domains/review';
export type PromptRequest = { kind: 'question'; text: string } | { kind: 'mapping'; text: string };
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
        <DialogHeader className="pr-8">
          <DialogTitle>{request?.kind === 'mapping' ? 'Agent review' : 'Copy context'}</DialogTitle>
          <DialogDescription>
            {request?.kind === 'mapping'
              ? 'Give the brief and evidence to an agent with access to the full repository.'
              : 'Send this step and its code to ChatGPT or your coding agent.'}
          </DialogDescription>
        </DialogHeader>
        <div className="prompt-dialog-body">
          <Textarea value={request?.text ?? ''} readOnly rows={7} aria-label="Review context" />
          {request?.kind === 'mapping' ? (
            <form
              className="dialog-form"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  const data = new FormData(event.currentTarget),
                    raw = data.get('map');
                  if (typeof raw !== 'string') throw new Error('Paste the authored review JSON.');
                  const value: unknown = JSON.parse(
                    raw
                      .trim()
                      .replace(/^```(?:json)?\s*/, '')
                      .replace(/\s*```$/, ''),
                  );
                  const pack = validatePack(value);
                  if (pack.mapping !== 'authored')
                    throw new Error('Import an agent-authored review pack.');
                  onApply(pack);
                  setError('');
                  onClose();
                  toast.success('Authored review imported.');
                } catch (error) {
                  setError(error instanceof Error ? error.message : 'Invalid review pack.');
                }
              }}
            >
              <label htmlFor="map-json">Authored review JSON</label>
              <Textarea id="map-json" name="map" rows={5} required />
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit">Import review</Button>
            </form>
          ) : null}
        </div>
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
      </DialogContent>
    </Dialog>
  );
}
