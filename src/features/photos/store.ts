import { getBlob } from '../../adapters/storage/idb';
import type { Project } from '../../core/project/schema';

/** Lädt die Fotos eines Projekts als dekodierte Bilder (für Vorschau und Export). Fehlende/defekte werden ausgelassen. */
export async function loadPhotoImages(project: Pick<Project, 'photos'>): Promise<Map<string, ImageBitmap>> {
  const out = new Map<string, ImageBitmap>();
  for (const p of project.photos) {
    if (!p.position) continue;
    try {
      const stored = await getBlob(p.assetId);
      if (stored) out.set(p.id, await createImageBitmap(stored.blob));
    } catch {
      /* defektes Foto: im Video weglassen statt den Export abzubrechen */
    }
  }
  return out;
}

export function disposePhotoImages(images: Map<string, ImageBitmap>): void {
  for (const b of images.values()) b.close();
  images.clear();
}
