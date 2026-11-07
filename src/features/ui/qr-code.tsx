import { encode } from "uqr";

/**
 * A QR code drawn as one SVG path (no images, no network). Dark modules are
 * ink on white with a 2-module quiet zone, which phone cameras need.
 */
export function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { data, size } = encode(value, { ecc: "M", border: 2 });
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y][x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg
      className={`qr ${className}`}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#1c1a17" />
    </svg>
  );
}
