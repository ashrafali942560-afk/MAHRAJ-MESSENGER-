/**
 * Helper to compress and resize images on the client-side to fit within database limits.
 * Downscales images to dynamic maximum bounds and exports as a low-footprint jpeg.
 */
export function compressImageBase64(
  base64Str: string,
  maxWidth = 150,
  maxHeight = 150,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith("data:image")) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64Str;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions preserving aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        // Clean white/transparent background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight low-footprint JPEG format
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      } catch (err) {
        console.warn("Canvas compression runtime error:", err);
        resolve(base64Str);
      }
    };

    img.onerror = (err) => {
      console.warn("Could not load image tag resource for downscaling:", err);
      resolve(base64Str);
    };
  });
}
