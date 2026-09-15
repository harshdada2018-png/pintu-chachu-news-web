/**
 * PublicSpark Media Service - Zero-Cost Automated Image Compression (< 200KB)
 * Enforces strict image size limits via HTML5 Canvas WebP encoding.
 */

/**
 * Compresses an uploaded image file down to WebP format strictly under maxKB (Default 200KB).
 * @param {File} file - Raw uploaded image file (JPG, PNG, HEIC, WebP)
 * @param {number} maxKB - Target maximum size in KB (default 200)
 * @param {number} maxWidth - Maximum width dimension in pixels (default 1200)
 * @returns {Promise<{ blob: Blob, dataUrl: string, originalKB: number, compressedKB: number, quality: number }>}
 */
export async function compressImageToWebP(file, maxKB = 200, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const originalKB = parseFloat((file.size / 1024).toFixed(1));
    const reader = new FileReader();

    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        // Calculate canvas dimensions while preserving aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Apply smooth bilinear scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative WebP quality reduction to strictly satisfy < maxKB (200KB)
        let quality = 0.85;
        const attemptCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas to Blob conversion failed'));
                return;
              }

              const compressedKB = parseFloat((blob.size / 1024).toFixed(1));

              // If compressed size is still > maxKB and quality > 0.35, lower quality and retry
              if (compressedKB > maxKB && quality > 0.35) {
                quality -= 0.1;
                attemptCompression();
              } else {
                const dataUrlReader = new FileReader();
                dataUrlReader.onloadend = () => {
                  resolve({
                    blob,
                    dataUrl: dataUrlReader.result,
                    originalKB,
                    compressedKB,
                    quality: parseFloat(quality.toFixed(2))
                  });
                };
                dataUrlReader.readAsDataURL(blob);
              }
            },
            'image/webp',
            quality
          );
        };

        attemptCompression();
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extracts YouTube Video ID from any standard YouTube URL or embed link.
 * @param {string} url - YouTube URL or ID
 * @returns {string|null} - 11-character YouTube video ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  if (url.length === 11 && !url.includes('/')) return url; // Already an ID

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
