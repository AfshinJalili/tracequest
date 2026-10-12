import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { defaultPreferences } from '@/domains/preferences';
import { loadPreferences, persistPreferences } from '@/persistence/preferences-storage';

export function usePreferences() {
  const [stored] = useState(loadPreferences);
  const [preferences, setPreferences] = useState(() =>
    stored.kind === 'ready' ? stored.preferences : defaultPreferences(),
  );
  useEffect(() => {
    if (stored.kind === 'invalid') toast.error(`Could not load settings: ${stored.message}`);
  }, [stored]);

  function setKeyboardShortcuts(enabled: boolean) {
    const next = { ...preferences, keyboardShortcuts: enabled };
    try {
      persistPreferences(next);
      setPreferences(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Settings could not be saved.');
    }
  }
  return { preferences, setKeyboardShortcuts };
}
