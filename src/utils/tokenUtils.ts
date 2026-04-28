/**
 * Token utility functions for formatting and parsing
 */

import type { GenerateResponse } from '../types/api';

/**
 * Format token count with thousands separator
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }
  return tokens.toLocaleString('en-US');
}

/**
 * Extract token usage from API response
 */
export function parseTokenUsage(response: GenerateResponse): number {
  return response.token_used !== undefined ? response.token_used : 0;
}
