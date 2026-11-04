import { Avatar } from "@chakra-ui/react";
import { apiUrl } from "@/lib/api";

// A team member's picture, or their initials in gold when they have none.
export function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
}) {
  return (
    <Avatar.Root size={size} bg="gold.300" color="brand.950" borderWidth="1px" borderColor="gold.200" flexShrink={0}>
      <Avatar.Fallback name={name} fontWeight="semibold" />
      {avatarUrl && <Avatar.Image src={apiUrl(avatarUrl)} alt="" />}
    </Avatar.Root>
  );
}
