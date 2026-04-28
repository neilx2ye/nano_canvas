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
 * Convert a base64 data URL to a Blob for writing to disk.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid image data URL');
  }

  const [, mimeType, base64Data] = match;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function getImageExtension(imageData: string): string {
  const mimeType = imageData.match(/^data:([^;]+);base64,/)?.[1];

  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
    default:
      return 'png';
  }
}

function formatTimestamp(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '_',
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 36);
}

export function buildImageFilename(
  imageData: string,
  prompt: string,
  createdAt = new Date(),
  prefix = 'nano_canvas',
): string {
  const promptPrefix = sanitizeFilenamePart(prompt) || 'image';
  const timestamp = formatTimestamp(createdAt);
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const extension = getImageExtension(imageData);

  return `${prefix}_${timestamp}_${uniqueId}_${promptPrefix}.${extension}`;
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
  const filename = buildImageFilename(imageData, prompt);
  downloadImage(imageData, filename);
}
