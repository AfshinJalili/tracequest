import { MAX_IMPORT_BYTES } from './schema';

function describeLimit(maxBytes: number) {
  return { maxBytes, label: `${maxBytes / 1_000_000} MB` };
}

export const fileImportLimits = {
  diff: describeLimit(MAX_IMPORT_BYTES),
  // A saved review includes patches, evidence, source context, and checkpoints.
  review: describeLimit(30_000_000),
};
