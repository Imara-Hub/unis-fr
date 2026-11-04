import { Flex, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Flex justify="space-between" align={{ base: "stretch", sm: "flex-end" }} gap="4" mb="8" direction={{ base: "column", sm: "row" }}>
      <Stack gap="2" minW="0">
        <Heading
          as="h1"
          fontFamily="display"
          fontWeight="normal"
          fontSize={{ base: "3xl", md: "4xl" }}
          lineHeight="1.15"
          color="brand.900"
        >
          {title}
        </Heading>
        {description && (
          <Text color="fg.muted" maxW="2xl">
            {description}
          </Text>
        )}
      </Stack>
      {actions}
    </Flex>
  );
}
