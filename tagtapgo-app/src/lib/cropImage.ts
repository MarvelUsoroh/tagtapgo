/**
 * Canvas-based image crop utility
 * Takes a source image URL and a crop area (from react-easy-crop) and
 * returns a cropped Blob ready for upload to Supabase Storage.
 */

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a cropped image Blob from a source image URL and pixel crop data.
 *
 * @param imageSrc - The data URL or object URL of the source image
 * @param pixelCrop - The pixel-perfect crop area from react-easy-crop
 * @param outputSize - The size of the square output image in pixels (default: 400)
 * @returns A Promise that resolves to a Blob containing the cropped image
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outputSize = 400
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Output is always a square at `outputSize` resolution
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Fill transparent background with white (for JPEG uploads)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw the cropped region of the source image scaled up to outputSize
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      },
      'image/jpeg',
      0.92
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (e) => reject(e));
    // Allow CORS for external sources
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = src;
  });
}
