import { Image } from "@chakra-ui/react";
import { authedUrl } from "@/lib/api";

// Passport photo from the API (login required). Uses the per-tab token so several windows of the
// same browser each load photos as their own user.
// "avatar": a small circle (tables where room is short).
export function ParticipantPhoto({ path, size }: { path: string; size: "avatar" | "thumb" | "medium" | "large" }) {
  const dims =
    size === "avatar"
      ? { w: "8", h: "8" }
      : size === "thumb"
        ? { w: "10", h: "12" }
        : size === "medium"
          ? { w: "16", h: "20" }
          : { w: "40", h: "52" };
  return (
    <Image
      src={authedUrl(path)}
      alt=""
      {...dims}
      flexShrink={0}
      objectFit="cover"
      rounded={size === "avatar" ? "full" : size === "thumb" ? "sm" : "md"}
      objectPosition={size === "avatar" ? "center 25%" : undefined}
      bg="bg.muted"
      loading="lazy"
    />
  );
}
