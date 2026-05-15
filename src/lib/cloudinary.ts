import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

// ============================================================================
// Cloudinary read helpers.
//
// The Node SDK auto-configures from `CLOUDINARY_URL` (env), so this module
// doesn't call `cloudinary.config(...)` explicitly. The `NEXT_PUBLIC_*`
// cloud-name var is used by `next-cloudinary`'s `<CldImage>` on the client
// side; the SDK here is server-only and uses the full API-key URL.
//
// Today: one function — `listFolder(prefix)`. Returns the assets whose
// public_id starts with `<prefix>/` (trailing slash is appended so
// `bedroom/1/` doesn't accidentally match `bedroom/10/`).
//
// Errors are swallowed — a missing folder, missing env var, or
// rate-limit blip returns `[]` rather than throwing. The wireframe
// filters empty sections out, so the UX degrades to "no photos in this
// category" rather than a 500 page.
//
// See `docs/cloudinary.md` for the folder convention this helper queries
// against.
// ============================================================================

export type CloudinaryPhoto = {
  publicId: string;
  width: number;
  height: number;
  format: string;
  createdAt: string;
};

type AdminResource = {
  public_id: string;
  width: number;
  height: number;
  format: string;
  created_at: string;
};

/**
 * List every image asset whose public_id is a direct or nested descendant
 * of `prefix`. The trailing slash matters — without it, `bedroom/1` would
 * collide with hypothetical `bedroom/10`.
 *
 * Results are sorted by `public_id` so the page render order is stable
 * across loads (Cloudinary's default ordering is otherwise unspecified).
 */
export async function listFolder(prefix: string): Promise<CloudinaryPhoto[]> {
  const normalised = prefix.endsWith('/') ? prefix : `${prefix}/`;
  try {
    const res = await cloudinary.api.resources({
      type: 'upload',
      prefix: normalised,
      max_results: 100,
      resource_type: 'image',
    });
    const photos: CloudinaryPhoto[] = (res.resources as AdminResource[]).map((r) => ({
      publicId: r.public_id,
      width: r.width,
      height: r.height,
      format: r.format,
      createdAt: r.created_at,
    }));
    photos.sort((a, b) => a.publicId.localeCompare(b.publicId));
    return photos;
  } catch (err) {
    // Folder missing / SDK not configured / API down — all the same to
    // the caller. Log so it's visible in server output, return empty.
    console.warn(`[cloudinary] listFolder(${normalised}) failed:`, (err as Error)?.message ?? err);
    return [];
  }
}
