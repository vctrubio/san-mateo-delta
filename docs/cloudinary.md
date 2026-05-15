# Cloudinary

How Finca San Mateo images are organised, uploaded, and read by the app.

This file is the *contract* the admin and the code agree on. Photos go into
specific folders; the app derives URLs from `property.slug` + category;
nothing fans out into hardcoded URL lists.

## Folder convention

Cloudinary root for this project is **`san-mateo/`**. Inside it:

```
san-mateo/
  finca/
    levante/
      home/          # 4 photos — overview / signature shots
      exterior/      # 4 photos — facade, garden, driveway
      bedroom/
        1/           # 4 photos
        2/           # 4 photos
        3/           # 4 photos
      bathroom/
        1/           # 3 photos
        2/           # 3 photos
      terrace/       # 4 photos
    estrecho/
      home/
      exterior/
      bedroom/1/
      bathroom/1/
      terrace/
    marea/
      ...
    cala/
      ...
  banners/           # estate-level banner imagery (FincaBanner replacement)
  about/             # estate-level "about" photos (FincaPortal, FincaPalm, ...)
  hosts/             # david.jpg, tano.jpg, lucia.jpg
```

The `PropertyPhotosWireframe` component on `/finca/[slug]` reads the
property's `bedrooms` + `bathrooms` + `m2_terrace` counts to derive the
chip list. The same derivation drives which folders the admin needs to
create. If a property has 3 bedrooms, the app expects
`san-mateo/finca/{slug}/bedroom/1/`, `.../2/`, `.../3/`.

**Filenames inside each folder don't matter** — the app lists everything
in the folder and renders in upload order (or sorted by `created_at`).
Pick `1.jpg`, `2.jpg`, ... or let your phone's filename ride; either
works.

## Setup (one-time)

### 1. Cloudinary account

Sign up at https://cloudinary.com (free tier covers everything we need
at this volume — 25 credits/month ≈ tens of thousands of image
transformations).

Find your **cloud name** on the dashboard (top-right, under your name).
Looks like `dxxxxxx` or a slug you pick on signup.

Generate an **API key + secret** at *Settings → Access Keys*.

### 2. Env vars

Add to `.env.local`:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Update `.env.example` to mirror the keys (without values). The cloud
name is public — it sits in every image URL — so the `NEXT_PUBLIC_`
prefix is correct. The API key + secret are server-only (no
`NEXT_PUBLIC_`); they're used to list folder contents at build time.

### 3. Packages

```
bun add cloudinary next-cloudinary
```

- `cloudinary` — official SDK, used server-side to list folder contents
  via the Admin API.
- `next-cloudinary` — `<CldImage>` component, image-URL builder, OG
  helpers that play nice with Next/Image.

### 4. Create the folders

In the Cloudinary Media Library, create the root folder `san-mateo/`
and the substructure above. You can also do this lazily — uploads
auto-create their parent folder.

### 5. Upload photos

Drag and drop into the relevant folder via the Cloudinary dashboard.
Filenames don't matter. Tag with the property slug and the category
(`levante`, `bedroom`) if you want flexible queries later — see
*Tags vs folders* below.

## How the app reads photos

Two patterns, depending on where in the app:

### A) Pre-known images (hero, banner, host avatars)

Reference by public-id directly via `<CldImage>`:

```tsx
import { CldImage } from 'next-cloudinary';

<CldImage
  src="san-mateo/banners/FincaBanner"
  alt=""
  width={2400}
  height={1600}
  priority
/>
```

Cloudinary auto-serves WebP/AVIF, the right size for the device, and a
blurred placeholder. `next-cloudinary` wires all of that.

### B) Folder listings (per-property galleries)

Server-only — uses the API secret. Add a helper in `src/lib/photos.ts`:

```ts
import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type CloudinaryPhoto = {
  publicId: string;
  width: number;
  height: number;
  format: string;
};

/** List every asset in a Cloudinary folder. */
export async function listFolder(prefix: string): Promise<CloudinaryPhoto[]> {
  const res = await cloudinary.api.resources({
    type: 'upload',
    prefix,                  // e.g. 'san-mateo/finca/levante/bedroom/1'
    max_results: 100,
    resource_type: 'image',
  });
  return res.resources.map((r: any) => ({
    publicId: r.public_id,
    width: r.width,
    height: r.height,
    format: r.format,
  }));
}
```

`PropertyPhotosWireframe` becomes a thin server wrapper that calls
`listFolder('san-mateo/finca/{slug}/{category}/')` and renders
`<CldImage>` per asset. Cache the result with Next's `fetch` revalidate
or `unstable_cache` since the photo list rarely changes.

## Tags vs folders

Folders are the primary organisation. Tags are a parallel dimension:

- Add tag `levante` to every Levante photo, regardless of category.
  Lets you list "everything for Levante" in one Admin API call without
  walking sub-folders.
- Add tag `hero` to the one photo per property you want as the card
  thumbnail.

Tag-based queries are cheaper at scale than folder walks, but at four
properties × ~5 categories we won't notice. Pick one approach and stay
consistent.

## Migration from `/public/images` and `/public/finca`

Current state:

```
public/images/{slug}.png      → san-mateo/finca/{slug}/home/1.jpg
public/images/{david|tano}.png → san-mateo/hosts/{david|tano}.jpg
public/finca/banners/*.jpg    → san-mateo/banners/*
public/finca/about/*.jpg      → san-mateo/about/*
```

Migration plan:

1. Upload existing assets to the matching Cloudinary locations.
2. Build a one-time map of old path → new public-id, paste into a
   working scratch file.
3. Search-and-replace `/images/` and `/finca/` URLs across the codebase
   with the `<CldImage>` calls. Bulk find: `src="/images/`,
   `src="/finca/`.
4. Run the app against Cloudinary, verify visually, then delete the
   files under `public/`.
5. Commit with the working scratch map appended in the commit body for
   audit, not committed as a file.

## What lives in the repo vs Cloudinary

The repo carries: the *shape* of the gallery (categories, counts,
component code, URL conventions). Cloudinary carries: the bytes.

If a future property gets a 4th bedroom, the change is:
1. `properties.bedrooms = 4` (DB).
2. Create folder `san-mateo/finca/{slug}/bedroom/4/` and upload.

No code change. The wireframe + the future `<CldImage>` renderer derive
both visual list and Cloudinary path from `property.bedrooms`.

## Operational tips

- **Image dimensions**: upload at 2400 px on the long edge, q 80–85.
  Cloudinary's automatic transformations handle responsive variants.
- **Originals**: archive raw photos outside Cloudinary (Google Drive or
  similar). Cloudinary is a CDN, not a backup.
- **Cleanup**: deleting from Cloudinary deletes from production; do it
  via the dashboard, never automated, never bulk without a dry-run.
- **Billing alarm**: set a notification at 80% of the free tier to
  avoid surprise charges.

## Reference

- Cloudinary Node SDK: https://cloudinary.com/documentation/node_integration
- `next-cloudinary` (the React/Next wrapper): https://next.cloudinary.dev
- Admin API resource listing: https://cloudinary.com/documentation/admin_api#get_resources
