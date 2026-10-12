import { MAX_IMPORT_BYTES } from './schema';

function describeLimit(maxBytes: number) {
  return { maxBytes, label: `${maxBytes / 1_000_000} MB` };
}

export const fileImportLimits = {
  diff: describeLimit(MAX_IMPORT_BYTES),
  review: describeLimit(MAX_IMPORT_BYTES),
};
