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
import { Input } from '@/components/ui/input';
import { modelSettingsSchema, type ModelSettings } from '@/integrations/model';
export function ModelSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ModelSettings | null;
  onSave: (settings: ModelSettings | null) => void;
}) {
  const [error, setError] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI settings</DialogTitle>
          <DialogDescription>
            Use an OpenAI-compatible HTTPS endpoint. Your key stays in memory for this tab.
          </DialogDescription>
        </DialogHeader>
        <form
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const result = modelSettingsSchema.safeParse({
              endpoint: data.get('endpoint'),
              model: data.get('model'),
              key: data.get('key'),
            });
            if (!result.success) {
              setError(result.error.issues[0]?.message ?? 'Invalid settings.');
              return;
            }
            onSave(result.data);
            setError('');
            onOpenChange(false);
            toast.success('AI configured.');
          }}
        >
          <label htmlFor="model-endpoint">API base URL</label>
          <Input
            id="model-endpoint"
            name="endpoint"
            type="url"
            defaultValue={settings?.endpoint}
            placeholder="https://your-provider.example/v1"
            required
          />
          <label htmlFor="model-name">Model ID</label>
          <Input
            id="model-name"
            name="model"
            defaultValue={settings?.model}
            placeholder="Model ID"
            required
          />
          <label htmlFor="model-key">API key</label>
          <Input
            id="model-key"
            name="key"
            type="password"
            autoComplete="off"
            placeholder="API key"
            required
          />
          <p className="form-help">
            Questions send this step's code to the provider. The endpoint must allow browser CORS
            requests.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onSave(null);
                onOpenChange(false);
              }}
            >
              Disconnect
            </Button>
            <Button type="submit">Connect</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
