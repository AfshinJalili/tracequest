import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { type Preferences } from '@/domains/preferences';

export function SettingsDialog({
  open,
  onOpenChange,
  preferences,
  onKeyboardShortcuts,
  onModelSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: Preferences;
  onKeyboardShortcuts: (enabled: boolean) => void;
  onModelSettings: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Application preferences saved in this browser for all reviews.
          </DialogDescription>
        </DialogHeader>
        <div className="settings-row">
          <div>
            <label htmlFor="keyboard-shortcuts">Keyboard shortcuts</label>
            <small id="keyboard-shortcuts-description">
              F sidebar · J next step · K previous step
            </small>
          </div>
          <Switch
            id="keyboard-shortcuts"
            checked={preferences.keyboardShortcuts}
            onCheckedChange={onKeyboardShortcuts}
            aria-describedby="keyboard-shortcuts-description"
          />
        </div>
        <div className="settings-model">
          <Button variant="outline" onClick={onModelSettings}>
            <Settings2 />
            AI settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
