/**
 * API request and response types for Nano Banana API (Google Gemini)
 */

import type { AspectRatio, ImageSize, ThinkingLevel } from './models';

// v2 简化的请求类型（Gemini API 不支持 seed/negative_prompt/steps/cfg_scale 等）
export interface GenerateRequest {
  model: string;
  prompt: string;
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
  width?: number;
  height?: number;
  ref_image?: string;     // 单张参考图（向后兼容）
  ref_images?: string[]; // 多张参考图
  thinking_level?: Exclude<ThinkingLevel, 'off'>;
  thinking_budget?: number;
}

export interface GenerateResponse {
  image: string;
  seed: number;
  token_used: number;
  processing_time_ms: number;
}

// v2: Thinking 模式响应
export interface ThinkingStep {
  text: string;
  timestamp: number;
}

export interface GenerateWithThinkingResponse {
  image: string;
  seed: number;
  token_used: number;
  processing_time_ms: number;
  thinking_steps: ThinkingStep[];
}

// v2: Mask 抠图（仅 v25_flash 支持）
export interface MaskImageRequest {
  model: string;
  prompt: string;
  original_image: string;
  mask: string;
  aspect_ratio?: AspectRatio;
}

export interface MaskImageResponse {
  image: string;
  seed: number;
  token_used: number;
  processing_time_ms: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export type ApiErrorCode =
  | 'INVALID_MODEL'
  | 'INVALID_PARAMS'
  | 'RATE_LIMITED'
  | 'INVALID_API_KEY'
  | 'IMAGE_TOO_LARGE'
  | 'INTERNAL_ERROR';
