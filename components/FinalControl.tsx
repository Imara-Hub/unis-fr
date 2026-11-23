"use client";

import { useMutation } from "@apollo/client/react";
import { Badge, Box, Button, Card, Circle, Flex, Heading, Text } from "@chakra-ui/react";
import { Crown, Undo2 } from "lucide-react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { CANCEL_FINAL, ENVELOPES, START_FINAL, STAGE, STAGE_QUEUE, type Round } from "@/lib/graphql/judging";
import { PARTICIPANT_COUNTS, PARTICIPANTS } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

const REFETCH = [{ query: STAGE }, { query: STAGE_QUEUE }, { query: PARTICIPANT_COUNTS }, { query: ENVELOPES }, { query: PARTICIPANTS, variables: { status: null, search: null, review: "APPROVED" as const } }];

// Admin only, on the stage page. In the tasfia: start the final once every participant has
// recited and been marked. The best `finalists` who passed go on, fixed from then on; the stage
// then calls only them and draws only final envelopes (half a page a question). In the final: the
// way back to the tasfia, while no finalist has drawn yet.
export function FinalControl({ round, finalists, tasfiaFinished }: { round: Round; finalists: number; tasfiaFinished: boolean }) {
  const { tx } = useI18n();
  const [start, starting] = useMutation(START_FINAL, { refetchQueries: REFETCH });
  const [cancel, cancelling] = useMutation(CANCEL_FINAL, { refetchQueries: REFETCH });

  async function onStart() {
    const ok = await confirmDialog({
      title: tx("Start the final"),
      message: tasfiaFinished
        ? tx("Start the final with {n} finalists? From now on only they are called, only final envelopes are drawn, and the tasfia scores can no longer change.", { n: finalists })
        : tx("Some approved participants have not recited in the tasfia: they will be left out. Start the final with {n} finalists anyway? The tasfia scores can no longer change after this.", { n: finalists }),
      confirmLabel: tx("Start the final"),
    });
    if (!ok) return;
    try {
      await start();
      toaster.create({ type: "success", title: tx("The final has started"), description: tx("Prepare the final envelopes (half a page a question) on the Questions page.") });
    } catch (err) {
      toaster.create({ type: "error", title: readApiError(err).message });
    }
  }

  async function onCancel() {
    const ok = await confirmDialog({
      title: tx("Back to the tasfia"),
      message: tx("Go back to the tasfia? The finalists are no longer fixed. Only possible while no finalist has drawn a final envelope."),
      confirmLabel: tx("Back to the tasfia"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await cancel();
    } catch (err) {
      toaster.create({ type: "error", title: readApiError(err).message });
    }
  }

  const final = round === "FINAL";
  return (
    <Card.Root overflow="hidden" borderTopWidth="3px" borderTopColor={final ? "gold.500" : "brand.700"}>
      <Card.Body p={{ base: "4", md: "6" }}>
        <Flex align="center" gap="4" wrap="wrap">
          <Circle size="11" bg={final ? "gold.400" : "brand.900"} color={final ? "brand.900" : "gold.300"} flexShrink={0}>
            <Crown size={20} aria-hidden />
          </Circle>
          <Box flex="1" minW="56">
            <Flex align="center" gap="2" wrap="wrap">
              <Heading size="md" color="brand.900">
                {final ? tx("The final") : tx("Tasfia")}
              </Heading>
              <Badge colorPalette={final ? "orange" : "teal"} variant="solid">
                {final ? tx("In progress") : tasfiaFinished ? tx("Finished") : tx("In progress")}
              </Badge>
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              {final
                ? tx("{n} finalists recite half a page a question from the final envelopes. Their final score is separate from the tasfia.", { n: finalists })
                : tx("When the tasfia is over, start the final: the best {n} who passed go on (Places in the final, in Settings).", { n: finalists })}
            </Text>
          </Box>
          {final ? (
            <Button size="sm" variant="ghost" colorPalette="red" loading={cancelling.loading} onClick={onCancel}>
              <Undo2 size={15} aria-hidden />
              {tx("Back to the tasfia")}
            </Button>
          ) : (
            <Button colorPalette="brand" loading={starting.loading} disabled={finalists === 0} onClick={onStart}>
              <Crown size={16} aria-hidden />
              {tx("Start the final")}
            </Button>
          )}
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
