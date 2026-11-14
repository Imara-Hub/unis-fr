import { chakra } from "@chakra-ui/react";

// A mark as the judges call it: the Arabic term, then its Swahili meaning in brackets,
// e.g. "فتح (ku kumbushwa)". The same in every language of the app.
// `big`: on the judges' mark buttons, where the Arabic must read at a glance.
export function MarkName({ mark, big = false }: { mark: { arabic: string; swahili: string }; big?: boolean }) {
  return (
    <chakra.span>
      <chakra.bdi
        lang="ar"
        dir="rtl"
        fontFamily="var(--font-arabic), serif"
        fontSize={big ? "1.8em" : "1.3em"}
        lineHeight={big ? "1" : undefined}
        fontWeight="bold"
      >
        {mark.arabic}
      </chakra.bdi>{" "}
      <chakra.span lang="sw" fontSize="0.8em" fontWeight="medium" opacity={0.85}>
        ({mark.swahili})
      </chakra.span>
    </chakra.span>
  );
}
