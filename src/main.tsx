import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppRouter } from '@/app/router';
import '@/styles.css';
const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <AppRouter />
      <Toaster theme="dark" richColors />
    </TooltipProvider>
  </StrictMode>,
);
