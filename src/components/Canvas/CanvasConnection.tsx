// 将屏幕坐标转换为画布坐标
function screenToCanvas(
  screenX: number,
  screenY: number,
  viewport: number[],
  containerRect: DOMRect | null
): { x: number; y: number } {
  if (!containerRect) {
    return { x: screenX, y: screenY };
  }
  
  const relX = screenX - containerRect.left;
  const relY = screenY - containerRect.top;
  
  const zoom = viewport[0] || 1;
  const x = (relX - viewport[4]) / zoom;
  const y = (relY - viewport[5]) / zoom;
  
  return { x, y };
}

export interface ConnectionOverlayProps {
  fromPosition: { x: number; y: number };
  mousePosition: { x: number; y: number };
  viewport: number[];
  containerRect: DOMRect | null;
}

export function ConnectionOverlay({ fromPosition, mousePosition, viewport, containerRect }: ConnectionOverlayProps) {
  const canvasPos = screenToCanvas(mousePosition.x, mousePosition.y, viewport, containerRect);
  
  const fromX = fromPosition.x;
  const fromY = fromPosition.y;
  const toX = canvasPos.x;
  const toY = canvasPos.y;

  const dx = toX - fromX;
  const controlOffset = Math.abs(dx) * 0.3 + 50;
  const path = "M " + fromX + " " + fromY + " C " + (fromX + controlOffset) + " " + fromY + ", " + (toX - controlOffset) + " " + toY + ", " + toX + " " + toY;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-30"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <path
        d={path}
        fill="none"
        stroke="#000000"
        strokeWidth={3}
        strokeDasharray="10 5"
      />
      <circle cx={fromX} cy={fromY} r={8} fill="#000000" />
      <circle cx={toX} cy={toY} r={6} fill="#000000" />
    </svg>
  );
}
