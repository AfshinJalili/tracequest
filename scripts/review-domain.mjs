import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

export async function loadReviewDomain() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  // Both CLIs use the application contract, not a separately maintained validator.
  const bundle = await build({
    root,
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: false,
      lib: { entry: path.join(root, 'src/domains/review/index.ts'), formats: ['es'] },
    },
  });
  const chunk = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(
    (item) => item.type === 'chunk',
  );
  if (!chunk) throw new Error('Could not load the review domain.');
  return import('data:text/javascript;base64,' + Buffer.from(chunk.code).toString('base64'));
}
