import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param buffer - File buffer to upload
 * @param folder - Cloudinary folder to upload to (e.g., 'avatars', 'recipes')
 * @param resourceType - Type of resource ('image', 'video', 'raw', 'auto')
 * @returns Promise with upload result containing url and public_id
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image'
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by public_id
 * @param publicId - The public ID of the file to delete
 * @param resourceType - Type of resource ('image', 'video', 'raw')
 * @returns Promise with deletion result
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export default cloudinary;
