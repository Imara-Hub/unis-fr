import { Badge } from "@chakra-ui/react";

// The participant's number, "N° 12": the same on the printed form, the lists and the stage.
export function NumberTag({ number, size = "sm" }: { number: number | null; size?: "sm" | "md" }) {
  if (number === null) return null;
  return (
    <Badge variant="outline" colorPalette="brand" size={size} fontVariantNumeric="tabular-nums" flexShrink={0}>
      N° {number}
    </Badge>
  );
}
