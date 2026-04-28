/**
 * Core data models for nano_canvas
 */

export type ModelType = 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro';
export type AspectRatio =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9'
  | '1:4'
  | '4:1'
  | '1:8'
  | '8:1';
export type ImageSize = '512' | '1K' | '2K' | '4K';
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * Version history for a canvas node
 */
export interface CanvasNodeVersion {
  id: string;
  imageData: string;
  createdAt: Date;
  prompt: string;
  model: string;
  tokenUsed: number;
}

/**
 * Represents a single image node on the infinite canvas
 */
export interface CanvasNode {
  id: string;
  imageData: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  createdAt: Date;
  prompt: string;
  model: string;
  tokenUsed: number;

  // v2 扩展字段
  annotation?: string;
  versions?: CanvasNodeVersion[];
  activeVersionId?: string;
  connectedFrom?: string;
  connectedTo?: string[];
  isDefaultVisible?: boolean;
}

/**
 * Configuration for image generation (Gemini API)
 */
export interface GenerationConfig {
  model: ModelType;
  prompt: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  imageSize?: ImageSize;
  refImage?: string;

  // Thinking level: off/minimal/low/medium/high
  // v25_flash: off only
  // v31_flash: minimal/low/medium/high
  // v3_pro: always thinking (no thinking param sent)
  thinkingLevel?: ThinkingLevel;
  thinkingBudget?: number;
  maskMode?: boolean;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  current: number;
  total: number;
}
