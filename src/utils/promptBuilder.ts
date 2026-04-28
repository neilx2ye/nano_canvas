import type { CanvasNode } from '../types';

export interface PromptReference {
  imageData: string;
  label: string;
  annotation?: string;
  prompt?: string;
  model?: string;
}

export function getOrderedNodeChain(nodes: CanvasNode[], anchorId: string | null): CanvasNode[] {
  if (!anchorId) return [];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  let start = byId.get(anchorId);
  if (!start) return [];

  const seenAncestors = new Set<string>();
  while (start.connectedFrom && !seenAncestors.has(start.connectedFrom)) {
    seenAncestors.add(start.id);
    const parent = byId.get(start.connectedFrom);
    if (!parent) break;
    start = parent;
  }

  const ordered: CanvasNode[] = [];
  const visited = new Set<string>();

  const walk = (node: CanvasNode) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    ordered.push(node);
    (node.connectedTo || []).forEach((childId) => {
      const child = byId.get(childId);
      if (child) walk(child);
    });
  };

  walk(start);
  return ordered.some((node) => node.id === anchorId) ? ordered : [byId.get(anchorId)!];
}

export function canvasNodesToPromptReferences(nodes: CanvasNode[]): PromptReference[] {
  return nodes.map((node, index) => ({
    imageData: node.imageData,
    label: `Image ${index + 1}`,
    annotation: node.annotation,
    prompt: node.model === 'uploaded' || node.prompt.startsWith('Uploaded:')
      ? undefined
      : node.prompt,
    model: node.model === 'uploaded' ? undefined : node.model,
  }));
}

export function buildPromptWithReferences(userPrompt: string, references: PromptReference[]): string {
  const trimmedPrompt = userPrompt.trim();
  if (references.length === 0) return trimmedPrompt;

  const lines = ['Use the following reference images in this exact order:'];

  references.forEach((reference, index) => {
    const pieces = [`Image ${index + 1}`];
    if (reference.annotation) {
      pieces.push(`note: "${reference.annotation}"`);
    }
    if (reference.prompt) {
      pieces.push(`source prompt: "${reference.prompt}"`);
    }
    if (reference.model) {
      pieces.push(`source model: ${reference.model}`);
    }
    lines.push(pieces.join(' | '));
  });

  if (trimmedPrompt) {
    lines.push(`User request: ${trimmedPrompt}`);
  }

  return lines.join('\n');
}
