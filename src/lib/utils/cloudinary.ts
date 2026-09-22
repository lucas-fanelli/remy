/** Only render images from the trusted Cloudinary CDN */
export const isCloudinaryUrl = (url: string) => url.startsWith('https://res.cloudinary.com/');

/**
 * How big the image actually needs to be, by where it is going.
 *
 * Measured on production before this existed: the feed served recipe photos at their full
 * upload resolution — 4096×2304 and 4093×2680 — into a box 554×416 on screen. That is
 * roughly forty times the pixels anyone sees, and a photo that size is two to four
 * megabytes. Avatars were worse in ratio: 736×736 delivered for a 40×40 circle.
 *
 * Nothing had to be re-uploaded or reprocessed to fix it. Cloudinary resizes on delivery;
 * the transformation is a path segment that was simply never filled in, so every URL the
 * app built asked for the original.
 *
 * Sizes are generous on purpose — roughly twice the largest layout size — so a retina
 * screen still gets a sharp image. `f_auto` picks WebP or AVIF when the browser takes it
 * and `q_auto` sets quality from the image's own content.
 */
const PRESETS = {
  /** A 24–64px circle: navigation, a byline, a comment. */
  avatar: 'w_128,h_128,c_fill,g_face,f_auto,q_auto',
  /** The profile header's portrait, which renders around 120px. */
  avatarLarge: 'w_320,h_320,c_fill,g_face,f_auto,q_auto',
  /** A recipe card's 4:3 photo, at most ~600px wide in a three-column grid. */
  card: 'w_1200,c_fill,ar_4:3,f_auto,q_auto',
  /** The recipe page's cover, which spans the content column. */
  hero: 'w_1800,c_limit,f_auto,q_auto',
} as const;

export type ImagePreset = keyof typeof PRESETS;

/**
 * Ask Cloudinary for the size this image is going to be displayed at.
 *
 * ```ts
 * <Avatar src={cloudinaryImage(user.avatar, 'avatar')} />
 * ```
 *
 * Anything that is not a Cloudinary URL comes back untouched, including `undefined` and
 * `null`, so a call site does not have to guard before calling. A URL that already carries
 * a transformation is left alone too — a second one would be applied on top of the first.
 */
export function cloudinaryImage<T extends string | null | undefined>(
  url: T,
  preset: ImagePreset
): T {
  if (!url || !isCloudinaryUrl(url)) return url;

  // Cloudinary delivery URLs are `<...>/upload/<transformations?>/<version>/<public-id>`.
  // With nothing between `upload` and the version, the original is served.
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const tail = url.slice(at + marker.length);
  const firstSegment = tail.split('/')[0];

  // Cloudinary cannot tell a transformation from a public id by grammar alone, so this
  // uses the two shapes that are unambiguous and declines the rest:
  //
  //   `v1768227853/recipes/x.jpg`  a version — every upload this app makes looks like this
  //   `sample.jpg`                 no underscore, so it cannot be a `k_v` transformation
  //   `w_1200,c_fill/...`          already transformed; a second would resize the resize
  //
  // A public id that genuinely contains an underscore and no version is left untouched.
  // That is a miss rather than a bug: the image is served at its original size, exactly as
  // it was before any of this, and guessing wrong would mean asking Cloudinary to scale an
  // already scaled copy.
  const isVersion = /^v\d+$/.test(firstSegment);
  const cannotBeATransformation = !firstSegment.includes('_');
  if (!isVersion && !cannotBeATransformation) return url;

  return `${url.slice(0, at + marker.length)}${PRESETS[preset]}/${tail}` as T;
}
