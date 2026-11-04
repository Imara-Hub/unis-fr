import { Image } from "@chakra-ui/react";
import { apiUrl } from "@/lib/api";

// Passport photo from the API (the login cookie is sent, so only logged-in users see it).
export function ParticipantPhoto({ path, size }: { path: string; size: "thumb" | "large" }) {
  const dims = size === "thumb" ? { w: "10", h: "12" } : { w: "40", h: "52" };
  return (
    <Image
      src={apiUrl(path)}
      alt=""
      {...dims}
      flexShrink={0}
      objectFit="cover"
      rounded={size === "thumb" ? "sm" : "md"}
      bg="bg.muted"
      loading="lazy"
    />
  );
}
