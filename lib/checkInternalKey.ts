// 📁 lib/checkInternalKey.ts
import { NextRequest } from 'next/server';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

if (!INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
  console.error(
    "FATAL SECURITY ERROR: INTERNAL_API_KEY environment variable is not set in production!"
  );
  // Podrías lanzar un error aquí para detener el arranque en prod sin clave
}

export function checkInternalKey(req: NextRequest): boolean {
  if (!INTERNAL_API_KEY) {
    console.error("Security check failed: INTERNAL_API_KEY not configured on server.");
    return false;
  }
  const receivedKey = req.headers.get('x-internal-key');
  if (!receivedKey) {
    console.warn("Internal API check: Missing 'x-internal-key' header.");
    return false;
  }
  const isValid = receivedKey === INTERNAL_API_KEY;
  if (!isValid) {
    console.warn("Internal API check: Invalid key received.");
  }
  return isValid;
}