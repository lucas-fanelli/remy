import { cloudinaryImage, isCloudinaryUrl } from '../cloudinary';

/**
 * Measured on production before this existed: the feed delivered recipe photos at
 * 4096×2304 into a box 554×416, and 736×736 avatars into 40×40 circles.
 */

const ORIGINAL = 'https://res.cloudinary.com/dfc0nner7/image/upload/v1768227853/recipes/abc123.jpg';

describe('isCloudinaryUrl', () => {
  it('accepts the CDN and nothing else', () => {
    expect(isCloudinaryUrl(ORIGINAL)).toBe(true);
    expect(isCloudinaryUrl('https://evil.example/res.cloudinary.com/x.jpg')).toBe(false);
    expect(isCloudinaryUrl('http://res.cloudinary.com/x.jpg')).toBe(false);
  });
});

describe('cloudinaryImage', () => {
  it('asks for the size the image will actually be shown at', () => {
    expect(cloudinaryImage(ORIGINAL, 'card')).toBe(
      'https://res.cloudinary.com/dfc0nner7/image/upload/w_1200,c_fill,ar_4:3,f_auto,q_auto/v1768227853/recipes/abc123.jpg'
    );
  });

  it('crops an avatar square, around the face', () => {
    const avatar = 'https://res.cloudinary.com/dfc0nner7/image/upload/v1764885672/avatars/u.jpg';

    expect(cloudinaryImage(avatar, 'avatar')).toContain('w_128,h_128,c_fill,g_face');
  });

  it('keeps the recipe cover large but bounded', () => {
    // `c_limit` rather than `c_fill`: a cover must not be cropped to an aspect ratio the
    // photographer did not choose.
    expect(cloudinaryImage(ORIGINAL, 'hero')).toContain('w_1800,c_limit');
  });

  it('always asks for a modern format and automatic quality', () => {
    (['avatar', 'avatarLarge', 'card', 'hero'] as const).forEach((preset) => {
      expect(cloudinaryImage(ORIGINAL, preset)).toContain('f_auto,q_auto');
    });
  });

  it('leaves anything that is not a Cloudinary URL exactly as it was', () => {
    // Call sites should not have to guard, and the brand logo is a local file.
    expect(cloudinaryImage('/chef-logo.png', 'avatar')).toBe('/chef-logo.png');
    expect(cloudinaryImage('https://example.com/a.jpg', 'card')).toBe('https://example.com/a.jpg');
  });

  it('passes undefined and null straight through', () => {
    expect(cloudinaryImage(undefined, 'avatar')).toBeUndefined();
    expect(cloudinaryImage(null, 'avatar')).toBeNull();
    expect(cloudinaryImage('', 'avatar')).toBe('');
  });

  it('does not stack a transformation on one that is already there', () => {
    // Applying twice would ask Cloudinary to resize the resized copy.
    const once = cloudinaryImage(ORIGINAL, 'card');

    expect(cloudinaryImage(once, 'hero')).toBe(once);
    expect(cloudinaryImage(once, 'card')).toBe(once);
  });

  it('leaves a delivery URL it does not recognise alone', () => {
    const odd = 'https://res.cloudinary.com/dfc0nner7/image/fetch/http://x.test/a.jpg';

    expect(cloudinaryImage(odd, 'card')).toBe(odd);
  });

  it('handles an unversioned public id, which local seed data uses', () => {
    // Found by measuring: five of the six images on a local feed were `/upload/sample.jpg`
    // and an earlier version of this skipped them, because it only recognised a `v<digits>`
    // segment. A name with no underscore cannot be a `k_v` transformation.
    const unversioned = 'https://res.cloudinary.com/dfc0nner7/image/upload/sample.jpg';

    expect(cloudinaryImage(unversioned, 'card')).toBe(
      'https://res.cloudinary.com/dfc0nner7/image/upload/w_1200,c_fill,ar_4:3,f_auto,q_auto/sample.jpg'
    );
  });

  it('declines an unversioned public id that could be read as a transformation', () => {
    // `my_photo.jpg` is indistinguishable from a transformation by grammar. Serving it
    // untransformed is what happened before any of this; resizing an already resized copy
    // is not recoverable.
    const ambiguous = 'https://res.cloudinary.com/dfc0nner7/image/upload/my_photo.jpg';

    expect(cloudinaryImage(ambiguous, 'card')).toBe(ambiguous);
  });
});
