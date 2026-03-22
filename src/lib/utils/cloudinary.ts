/** Only render images from the trusted Cloudinary CDN */
export const isCloudinaryUrl = (url: string) => url.startsWith('https://res.cloudinary.com/');
