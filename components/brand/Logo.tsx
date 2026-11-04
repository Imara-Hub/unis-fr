import Image from "next/image";

// The UNIS association badge (public/logo.png, 512×512, transparent around the circle).
// Every page that shows the logo uses this, so changing the file changes it everywhere.
export function Logo({ size = 48, priority }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="UNIS, Union des Initiatives Solidaires"
      width={size}
      height={size}
      priority={priority}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}
