import type { AspectRatio, GenerationConfig, ImageSize, ModelType, ThinkingLevel } from '../types';

export type ThinkingMode = 'unsupported' | 'always' | 'configurable';

export interface GeminiImageModelSpec {
  key: ModelType;
  specKey: 'v25_flash' | 'v3_pro' | 'v31_flash';
  modelId: string;
  label: string;
  codename: string;
  generation: string;
  tier: 'Flash' | 'Pro';
  status: 'GA' | 'Preview';
  aspectRatios: AspectRatio[];
  imageSizes: ImageSize[];
  defaultImageSize?: ImageSize;
  nativeSizeLabel?: string;
  thinkingMode: ThinkingMode;
  thinkingLevels: Exclude<ThinkingLevel, 'off'>[];
  maxReferenceImages: number;
  supportsMask: boolean;
  supportsFontInputs: boolean;
  supportsGoogleSearch: boolean;
  supportsImageGrounding: boolean;
  summary: string;
  requestNotes: string[];
}

export const STANDARD_ASPECT_RATIOS: AspectRatio[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
];

export const ULTRA_ASPECT_RATIOS: AspectRatio[] = ['1:4', '4:1', '1:8', '8:1'];

export const GEMINI_IMAGE_MODELS: Record<ModelType, GeminiImageModelSpec> = {
  'nano-banana': {
    key: 'nano-banana',
    specKey: 'v25_flash',
    modelId: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    codename: 'Nano Banana',
    generation: '2.5',
    tier: 'Flash',
    status: 'GA',
    aspectRatios: STANDARD_ASPECT_RATIOS,
    imageSizes: [],
    nativeSizeLabel: 'native 1024px',
    thinkingMode: 'unsupported',
    thinkingLevels: [],
    maxReferenceImages: 5,
    supportsMask: true,
    supportsFontInputs: false,
    supportsGoogleSearch: false,
    supportsImageGrounding: false,
    summary: 'Fast legacy image model. Use it for pixel-level mask / cutout work.',
    requestNotes: [
      'Does not send imageSize.',
      'Does not send thinkingConfig.',
      'Only model here with native segmentation mask support.',
    ],
  },
  'nano-banana-2': {
    key: 'nano-banana-2',
    specKey: 'v31_flash',
    modelId: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    codename: 'Nano Banana 2',
    generation: '3.1',
    tier: 'Flash',
    status: 'Preview',
    aspectRatios: [...STANDARD_ASPECT_RATIOS, ...ULTRA_ASPECT_RATIOS],
    imageSizes: ['512', '1K', '2K', '4K'],
    defaultImageSize: '1K',
    thinkingMode: 'configurable',
    thinkingLevels: ['minimal', 'low', 'medium', 'high'],
    maxReferenceImages: 14,
    supportsMask: false,
    supportsFontInputs: true,
    supportsGoogleSearch: true,
    supportsImageGrounding: true,
    summary: 'Recommended default. Best cost/speed balance with 512 and ultra-wide/tall ratios.',
    requestNotes: [
      'Sends imageSize with uppercase K values.',
      'Supports configurable thinking level.',
      'Supports the extra 1:4, 4:1, 1:8, and 8:1 ratios.',
    ],
  },
  'nano-banana-pro': {
    key: 'nano-banana-pro',
    specKey: 'v3_pro',
    modelId: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    codename: 'Nano Banana Pro',
    generation: '3.0',
    tier: 'Pro',
    status: 'Preview',
    aspectRatios: STANDARD_ASPECT_RATIOS,
    imageSizes: ['1K', '2K', '4K'],
    defaultImageSize: '1K',
    thinkingMode: 'always',
    thinkingLevels: ['minimal', 'low', 'medium', 'high'],
    maxReferenceImages: 14,
    supportsMask: false,
    supportsFontInputs: true,
    supportsGoogleSearch: true,
    supportsImageGrounding: false,
    summary: 'Highest quality option for brand-critical composition and precise typography.',
    requestNotes: [
      'Does not support 512 imageSize.',
      'Thinking is always on; no off mode is sent.',
      'Use for premium text rendering and complex multi-image composition.',
    ],
  },
};

export const MODEL_OPTIONS = Object.values(GEMINI_IMAGE_MODELS);

export function getModelSpec(model: string): GeminiImageModelSpec {
  const byAlias = GEMINI_IMAGE_MODELS[model as ModelType];
  if (byAlias) return byAlias;

  return (
    MODEL_OPTIONS.find((candidate) => candidate.modelId === model) ||
    GEMINI_IMAGE_MODELS['nano-banana-2']
  );
}

export function isGeminiModelType(model: string): model is ModelType {
  return Object.prototype.hasOwnProperty.call(GEMINI_IMAGE_MODELS, model);
}

export function getDefaultImageSize(model: ModelType): ImageSize | undefined {
  return GEMINI_IMAGE_MODELS[model].defaultImageSize;
}

export function getDefaultAspectRatio(model: ModelType): AspectRatio {
  return GEMINI_IMAGE_MODELS[model].aspectRatios[0];
}

export function getImageSizeLongEdge(imageSize?: ImageSize): number {
  switch (imageSize) {
    case '512':
      return 512;
    case '2K':
      return 2048;
    case '4K':
      return 4096;
    case '1K':
    default:
      return 1024;
  }
}

export function getDimensionsForAspectRatio(
  aspectRatio: AspectRatio,
  imageSize: ImageSize | undefined,
): { width: number; height: number } {
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  const longEdge = getImageSizeLongEdge(imageSize);

  if (widthRatio >= heightRatio) {
    return {
      width: longEdge,
      height: Math.max(1, Math.round((longEdge * heightRatio) / widthRatio)),
    };
  }

  return {
    width: Math.max(1, Math.round((longEdge * widthRatio) / heightRatio)),
    height: longEdge,
  };
}

export function sanitizeGenerationConfig(config: GenerationConfig): GenerationConfig {
  const model = isGeminiModelType(config.model) ? config.model : 'nano-banana-2';
  const spec = GEMINI_IMAGE_MODELS[model];
  const aspectRatio = spec.aspectRatios.includes(config.aspectRatio)
    ? config.aspectRatio
    : getDefaultAspectRatio(model);
  const imageSize = spec.imageSizes.includes(config.imageSize as ImageSize)
    ? config.imageSize
    : spec.defaultImageSize;
  const dimensions = getDimensionsForAspectRatio(aspectRatio, imageSize);

  return {
    ...config,
    model,
    aspectRatio,
    imageSize,
    width: dimensions.width,
    height: dimensions.height,
    maskMode: spec.supportsMask ? config.maskMode : false,
    thinkingLevel:
      spec.thinkingMode === 'configurable'
        ? config.thinkingLevel === 'off'
          ? 'low'
          : config.thinkingLevel || 'low'
        : undefined,
  };
}
