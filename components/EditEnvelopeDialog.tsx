"use client";

import { useMutation } from "@apollo/client/react";
import { Box, Button, Circle, CloseButton, Dialog, Flex, Portal, SimpleGrid, Text } from "@chakra-ui/react";
import { Dices, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { MushafPage } from "@/components/MushafPage";
import { QuestionPicker } from "@/components/QuestionPicker";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { UPDATE_ENVELOPE, type Envelope } from "@/lib/graphql/judging";
import { useI18n } from "@/lib/i18n";
import { parseRef, QUESTION_JUZ, randomRef, refText } from "@/lib/quran";

// The admin changes the 3 questions of an envelope not drawn yet, in a dialog over the list.
// Mount it with key={envelope.id}: it starts from that envelope's questions.
export function EditEnvelopeDialog({ envelope, onClose }: { envelope: Envelope; onClose: () => void }) {
  const { tx } = useI18n();
  // An old free-text question is not an ayah: it must be chosen again.
  const [questions, setQuestions] = useState<string[]>(() => envelope.questions.map((q) => (parseRef(q) ? q : "")));
  const [preview, setPreview] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [update, { loading }] = useMutation(UPDATE_ENVELOPE);
  // The dropdown lists open inside the dialog, so the dialog does not take a click on them as "outside".
  const contentRef = useRef<HTMLDivElement>(null);
  const setQuestion = (i: number, value: string) => setQuestions((all) => all.map((old, j) => (j === i ? value : old)));
  const previewRef = preview !== null ? parseRef(questions[preview] ?? "") : null;

  async function save() {
    setError(null);
    setFieldErrors({});
    try {
      await update({ variables: { id: envelope.id, questions } });
      toaster.create({ type: "success", title: tx("Questions {n} saved", { n: envelope.number }) });
      onClose();
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setFieldErrors(apiError.fields);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content ref={contentRef} maxW="5xl" w="full" borderTopWidth="3px" borderTopColor="gold.400">
            <Dialog.Header>
              <Flex align="center" gap="3">
                <Circle size="10" bg="brand.900" color="gold.300" flexShrink={0}>
                  <Pencil size={18} aria-hidden />
                </Circle>
                <Box>
                  <Dialog.Title color="brand.900">{tx("Change questions {n}", { n: envelope.number })}</Dialog.Title>
                  <Text fontSize="sm" color="fg.muted">
                    {tx("Choose the ayah each question starts from. The participant recites the whole page.")}
                  </Text>
                </Box>
              </Flex>
            </Dialog.Header>
            <Dialog.Body>
              <ErrorAlert message={error} />
              <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mt={error ? "4" : "0"}>
                {questions.map((q, i) => (
                  <QuestionPicker
                    key={i}
                    index={i}
                    value={q}
                    error={fieldErrors[`questions.${i}`]}
                    previewing={preview === i}
                    portalContainer={contentRef}
                    onChange={(value) => setQuestion(i, value)}
                    onPreview={() => setPreview((p) => (p === i ? null : i))}
                  />
                ))}
              </SimpleGrid>
              {previewRef && (
                <Box mt="4">
                  <MushafPage key={questions[preview!]} start={previewRef} maxH="50vh" />
                </Box>
              )}
            </Dialog.Body>
            <Dialog.Footer justifyContent="space-between" flexWrap="wrap" gap="3">
              <Button variant="outline" colorPalette="brand" onClick={() => setQuestions(QUESTION_JUZ.map((_, i) => refText(randomRef(i))))}>
                <Dices size={16} aria-hidden />
                {tx("Pick all 3 at random")}
              </Button>
              <Flex gap="2">
                <Button variant="ghost" onClick={onClose}>
                  {tx("Cancel")}
                </Button>
                <Button colorPalette="brand" loading={loading} disabled={questions.some((q) => !parseRef(q))} onClick={save}>
                  {tx("Save changes")}
                </Button>
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
