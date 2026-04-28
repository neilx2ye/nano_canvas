/**
 * Nano Banana API service layer (Google Gemini backend)
 * 支持多图参考
 */

import type {
  GenerateRequest,
  GenerateResponse,
  GenerateWithThinkingResponse,
  ThinkingStep,
  MaskImageRequest,
  MaskImageResponse,
  ApiError,
} from "../types";
import { getModelSpec } from "../constants/geminiImageModels";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const STORAGE_KEY = "nano_api_key";

function mapModelName(model: string): string {
  return getModelSpec(model).modelId;
}

export function isThinkingSupported(model: string): boolean {
  return getModelSpec(model).thinkingMode !== 'unsupported';
}

export function isConfigurableThinkingSupported(model: string): boolean {
  return getModelSpec(model).thinkingMode === 'configurable';
}

export function isMaskSupported(model: string): boolean {
  return getModelSpec(model).supportsMask;
}

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function removeApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasApiKey(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

async function handleApiError(response: Response): Promise<never> {
  let errorData: ApiError;
  try {
    errorData = await response.json();
  } catch {
    errorData = {
      error: {
        code: 'UNKNOWN',
        message: `HTTP ${response.status}: ${response.statusText}`,
      },
    };
  }
  const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
  (error as any).error = errorData.error;
  throw error;
}

// 辅助函数：将 base64 数据转换为 inlineData parts
function imageToInlineData(data: string): object {
  const match = data.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
  const mimeType = match?.[1] || 'image/png';
  const base64 = match?.[2] || data.replace(/^data:image\/\w+;base64,/, '');
  return {
    inlineData: {
      mimeType,
      data: base64,
    },
  };
}

function buildGenerationConfig(config: GenerateRequest, imageOnly = false): Record<string, unknown> {
  const spec = getModelSpec(config.model);
  const imageConfig: Record<string, string> = {};

  if (config.aspect_ratio && spec.aspectRatios.includes(config.aspect_ratio)) {
    imageConfig.aspectRatio = config.aspect_ratio;
  }

  if (spec.imageSizes.length > 0) {
    const imageSize = config.image_size || spec.defaultImageSize;
    if (imageSize && spec.imageSizes.includes(imageSize)) {
      imageConfig.imageSize = imageSize;
    }
  }

  const generationConfig: Record<string, unknown> = {
    responseModalities: imageOnly ? ['IMAGE'] : ['TEXT', 'IMAGE'],
  };

  if (Object.keys(imageConfig).length > 0) {
    generationConfig.imageConfig = imageConfig;
  }

  if (spec.thinkingMode === 'configurable' && config.thinking_level) {
    generationConfig.thinkingConfig = {
      thinkingLevel: config.thinking_level,
    };
  }

  return generationConfig;
}

export async function generateImage(config: GenerateRequest): Promise<GenerateResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error('API key is required');
    (error as any).error = { code: 'INVALID_API_KEY', message: 'API key is required' };
    throw error;
  }

  const modelName = mapModelName(config.model);
  const url = `${API_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  // 构建 parts 数组
  const parts: (object | string)[] = [{ text: config.prompt }];

  // 添加参考图片
  if (config.ref_images && config.ref_images.length > 0) {
    config.ref_images.forEach((img) => {
      parts.push(imageToInlineData(img));
    });
  } else if (config.ref_image) {
    parts.push(imageToInlineData(config.ref_image));
  }

  const requestBody: any = {
    contents: [{
      role: 'user',
      parts,
    }],
    generationConfig: buildGenerationConfig(config),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return handleApiError(response);
  }

  const data = await response.json();
  return parseGeminiResponse(data);
}

export async function generateImageWithThinking(
  config: GenerateRequest & {
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
    thinkingBudget?: number;
  }
): Promise<GenerateWithThinkingResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error('API key is required');
    (error as any).error = { code: 'INVALID_API_KEY', message: 'API key is required' };
    throw error;
  }

  const normalizedConfig = {
    ...config,
    thinking_level: config.thinking_level || config.thinkingLevel,
  };
  const modelName = mapModelName(normalizedConfig.model);

  if (!isThinkingSupported(normalizedConfig.model)) {
    const result = await generateImage(normalizedConfig);
    return {
      ...result,
      thinking_steps: [],
    };
  }

  const url = `${API_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  // 构建 parts 数组
  const parts: (object | string)[] = [{ text: config.prompt }];

  // 添加参考图片
  if (config.ref_images && config.ref_images.length > 0) {
    config.ref_images.forEach((img) => {
      parts.push(imageToInlineData(img));
    });
  } else if (config.ref_image) {
    parts.push(imageToInlineData(config.ref_image));
  }

  const requestBody: any = {
    contents: [{
      role: 'user',
      parts,
    }],
    generationConfig: buildGenerationConfig(normalizedConfig),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return handleApiError(response);
  }

  const data = await response.json();
  return parseGeminiThinkingResponse(data);
}

export async function maskImage(config: MaskImageRequest): Promise<MaskImageResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error('API key is required');
    (error as any).error = { code: 'INVALID_API_KEY', message: 'API key is required' };
    throw error;
  }

  const spec = getModelSpec(config.model);
  if (!spec.supportsMask) {
    const error = new Error('Mask mode is only supported by Nano Banana / gemini-2.5-flash-image');
    (error as any).error = {
      code: 'INVALID_MODEL',
      message: 'Mask mode is only supported by Nano Banana / gemini-2.5-flash-image',
    };
    throw error;
  }

  const modelName = spec.modelId;
  const url = `${API_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: config.original_image.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: config.mask.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
        {
          text: `${config.prompt}\n\nUse the first image as reference and the second image as mask. Only modify the masked areas while keeping the rest unchanged.`,
        },
      ],
    }],
    generationConfig: buildGenerationConfig(
      {
        model: config.model,
        prompt: config.prompt,
        aspect_ratio: config.aspect_ratio,
      },
      true,
    ),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return handleApiError(response);
  }

  const data = await response.json();
  const result = parseGeminiResponse(data);
  return {
    image: result.image,
    seed: result.seed,
    token_used: result.token_used,
    processing_time_ms: result.processing_time_ms,
  };
}

function parseGeminiResponse(data: any): GenerateResponse {
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response from API');
  }

  const parts = candidates[0].content?.parts || [];
  let imageBase64 = '';
  let tokenCount = 0;

  for (const part of parts) {
    const inlineData = part.inlineData || part.inline_data;
    if (inlineData) {
      const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
      imageBase64 = `data:${mimeType};base64,${inlineData.data}`;
    }
  }

  if (!imageBase64) {
    for (const part of parts) {
      if (part.text) {
        throw new Error(`API returned text instead of image: ${part.text}`);
      }
    }
    throw new Error('No image in response');
  }

  const usageMetadata = data.usageMetadata;
  if (usageMetadata) {
    tokenCount = usageMetadata.totalTokenCount || 0;
  }

  return {
    image: imageBase64,
    seed: Date.now(),
    token_used: tokenCount,
    processing_time_ms: 0,
  };
}

function parseGeminiThinkingResponse(data: any): GenerateWithThinkingResponse {
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response from API');
  }

  const content = candidates[0].content;
  const parts = content?.parts || [];

  let imageBase64 = '';
  let thinkingSteps: ThinkingStep[] = [];
  let tokenCount = 0;

  for (const part of parts) {
    const inlineData = part.inlineData || part.inline_data;
    if (inlineData) {
      const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
      imageBase64 = `data:${mimeType};base64,${inlineData.data}`;
    } else if (part.text) {
      if (part.thought) {
        thinkingSteps.push({
          text: part.text,
          timestamp: Date.now(),
        });
      }
    }
  }

  if (!imageBase64) {
    for (const part of parts) {
      if (part.text && !part.thought) {
        throw new Error(`API returned text instead of image: ${part.text}`);
      }
    }
    throw new Error('No image in response');
  }

  const usageMetadata = data.usageMetadata;
  if (usageMetadata) {
    tokenCount = usageMetadata.totalTokenCount || 0;
  }

  return {
    image: imageBase64,
    seed: Date.now(),
    token_used: tokenCount,
    processing_time_ms: 0,
    thinking_steps: thinkingSteps,
  };
}
