/**
 * Image utility functions for file conversion, validation, and download
 */

/**
 * Convert a File object to a base64 data URL.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validate an image file for type and size.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only PNG, JPG, and WebP images are supported' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be 10MB or smaller' };
  }

  return { valid: true };
}

/**
 * Convert HTMLCanvasElement to base64 data URL.
 */
export function canvasToBase64(canvas: HTMLCanvasElement, quality?: number): string {
  const q = quality !== undefined ? quality : 1.0;
  return canvas.toDataURL('image/png', q);
}

/**
 * Trigger browser download for base64 image data.
 */
export function downloadImage(base64Data: string, filename: string): void {
  const link = document.createElement('a');
  link.href = base64Data;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download a generated image node with timestamp and prompt prefix.
 */
export function downloadNodeImage(imageData: string, prompt: string): void {
  const promptPrefix = prompt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 20);
  const timestamp = Date.now();
  const filename = `nano_canvas_${timestamp}_${promptPrefix || 'image'}.png`;
  downloadImage(imageData, filename);
}
