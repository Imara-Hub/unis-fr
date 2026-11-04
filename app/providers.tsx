"use client";

import { ApolloProvider } from "@apollo/client/react";
import { ChakraProvider } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";
import { createApolloClient } from "@/lib/apollo";
import { LanguageProvider } from "@/lib/i18n";
import { system } from "@/lib/theme";
import { EmotionRegistry } from "./EmotionRegistry";

export function Providers({ children }: { children: ReactNode }) {
  // One Apollo client per browser tab.
  const [client] = useState(createApolloClient);

  return (
    <EmotionRegistry>
      <ChakraProvider value={system}>
        <ApolloProvider client={client}>
          <LanguageProvider>{children}</LanguageProvider>
        </ApolloProvider>
      </ChakraProvider>
    </EmotionRegistry>
  );
}
