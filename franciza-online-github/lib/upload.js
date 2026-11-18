import 'server-only';
import { DOC_MAX_BYTES, DOC_TYPES, sniffType } from '@/lib/ocr';

// Citește fișierul din FormData și verifică dimensiunea și tipul real (după octeți).
// Întoarce { buffer, type } sau { error }.
export async function readUpload(form) {
  const file = form.get('file');
  if (!file || typeof file === 'string') return { error: 'doc_no_file' };
  if (file.size > DOC_MAX_BYTES) return { error: 'doc_too_big' };
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buffer);
  if (!type || !DOC_TYPES.includes(type)) return { error: 'doc_bad_type' };
  return { buffer, type };
}
