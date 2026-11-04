import { useId } from "react";

// The eight-pointed star (۞, Rub el Hizb) that marks sections in a printed Quran.
// Two overlapping squares and a small circle, drawn as lines.
export function Octagram({ size = 32, strokeWidth = 1.5 }: { size?: number | string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="miter"
    >
      <rect x="10" y="10" width="28" height="28" />
      <rect x="10" y="10" width="28" height="28" transform="rotate(45 24 24)" />
      <circle cx="24" cy="24" r="6" />
    </svg>
  );
}

// The same star repeated as a lattice: each star's points join its neighbours,
// like the geometric borders around a Mushaf's opening pages. Fills its parent.
export function StarLattice({ color, opacity = 0.25, tile = 56 }: { color: string; opacity?: number; tile?: number }) {
  const id = `lattice-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const c = tile / 2; // star centre
  const h = tile / 4; // half side of the upright square
  const tip = c - h * Math.SQRT2; // where the rotated square's points reach

  return (
    <svg width="100%" height="100%" aria-hidden style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="1">
            <rect x={c - h} y={c - h} width={h * 2} height={h * 2} />
            <rect x={c - h} y={c - h} width={h * 2} height={h * 2} transform={`rotate(45 ${c} ${c})`} />
            <path
              d={[
                // points of the star → the edges of the tile (joins the stars left/right/up/down)
                `M${c} 0V${tip}`,
                `M${c} ${tile - tip}V${tile}`,
                `M0 ${c}H${tip}`,
                `M${tile - tip} ${c}H${tile}`,
                // corners of the square → the corners of the tile (joins the stars diagonally)
                `M0 0L${c - h} ${c - h}`,
                `M${tile} 0L${c + h} ${c - h}`,
                `M0 ${tile}L${c - h} ${c + h}`,
                `M${tile} ${tile}L${c + h} ${c + h}`,
              ].join("")}
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
}
