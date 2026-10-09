import { readExifGps, EXIF_READ_BYTES, type ExifGps } from './exif';
import { readImageSize, sniffImage, SNIFF_BYTES } from './sniff';

/** Grenzen für importierte Fotos (Schutz von Speicher und Decoder). */
export const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
export const PHOTO_MAX_PIXELS = 60_000_000;
/** Längste Kante der gespeicherten Kopie – reicht für eine Karte im 4K-Video und hält den Speicher klein. */
export const PHOTO_STORE_MAX_EDGE = 1280;

export type PhotoErrorCode = 'unsupported' | 'too_large' | 'too_many_pixels' | 'decode_failed';
export class PhotoError extends Error {
  constructor(public readonly code: PhotoErrorCode, message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}

export interface PreparedPhoto {
  /** Verkleinerte JPEG-Kopie ohne Metadaten (EXIF/Standort werden nicht übernommen). */
  blob: Blob;
  width: number;
  height: number;
  /** Aufnahmeort aus dem Original, falls vorhanden – nur zur Platzierung, wird nicht gespeichert. */
  gps: ExifGps | null;
}

/** Prüft die Datei, liest den Geo-Tag und erzeugt die verkleinerte, metadatenfreie Kopie. Alles lokal, ohne Netzwerk. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoError('too_large', String(file.size));
  // Typ und Größe aus dem Dateikopf (nicht aus dem MIME-Typ, der leer oder ungenau sein kann) – noch ohne Dekodierung.
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const kind = sniffImage(head);
  if (!kind) throw new PhotoError('unsupported', file.type || 'unknown');
  const size = readImageSize(head, kind);
  if (!size) throw new PhotoError('decode_failed', 'size unknown');
  if (size.width * size.height > PHOTO_MAX_PIXELS) throw new PhotoError('too_many_pixels', `${size.width}x${size.height}`);
  const gps = kind === 'jpeg' ? readExifGps(head.slice(0, EXIF_READ_BYTES).buffer as ArrayBuffer) : null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    throw new PhotoError('decode_failed', (e as Error).message);
  }
  try {
    if (bitmap.width * bitmap.height > PHOTO_MAX_PIXELS) throw new PhotoError('too_many_pixels', `${bitmap.width}x${bitmap.height}`); // Sicherheitsnetz, falls der Kopf täuscht
    const k = Math.min(1, PHOTO_STORE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * k));
    const height = Math.max(1, Math.round(bitmap.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoError('decode_failed', 'no 2d context');
    ctx.fillStyle = '#ffffff'; // Transparenz (PNG/WebP) auf Weiß
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new PhotoError('decode_failed', 'encode failed');
    return { blob, width, height, gps };
  } finally {
    bitmap.close();
  }
}
