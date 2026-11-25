"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, Flex, Text } from "@chakra-ui/react";
import { EyeOff, Megaphone } from "lucide-react";
import { useSyncExternalStore } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ShareLink } from "@/components/ShareLink";
import { toaster } from "@/components/Toaster";
import { GREETING } from "@/lib/greeting";
import { PARTICIPANT_COUNTS, SET_REVIEWS_PUBLISHED } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

const noSubscribe = () => () => {};

// The public check page (/check-registration): "received, being checked" for everyone until the
// admin publishes the decisions; then accepted (with the order of passage) or refused with the
// reason written when rejecting. Decisions made after publishing show at once.
// On the Registrations page and in Settings → Registration check (admin).
export function PublishReviews({ framed = true }: { framed?: boolean }) {
  const { tx } = useI18n();
  const counts = useQuery(PARTICIPANT_COUNTS);
  const [setPublished, { loading }] = useMutation(SET_REVIEWS_PUBLISHED, { refetchQueries: [PARTICIPANT_COUNTS] });
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  if (!counts.data) return null;
  const published = Boolean(counts.data.settings.reviewsPublished);
  const waiting = counts.data.participantCounts.awaitingReview ?? 0;

  async function toggle() {
    const ok = await confirmDialog({
      title: published ? tx("Hide the decisions?") : tx("Publish the decisions?"),
      message: published
        ? tx("The check page will say “received, being checked” for everyone again.")
        : waiting > 0
          ? tx("{n} registrations are still waiting for review: they will show as “being checked”. Anyone who types a name will see whether it was accepted, and the reason when it was rejected.", { n: waiting })
          : tx("Anyone who types a name will see whether it was accepted, and the reason when it was rejected."),
      confirmLabel: published ? tx("Hide the decisions") : tx("Publish the decisions"),
      destructive: published,
    });
    if (!ok) return;
    const res = await setPublished({ variables: { published: !published } }).catch(() => null);
    toaster.create(
      res?.data
        ? { type: "success", title: published ? tx("Decisions hidden") : tx("Decisions published") }
        : { type: "error", title: tx("Could not save. Check the connection and try again.") },
    );
  }

  const body = (
    <>
      <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} gap="4" direction={{ base: "column", md: "row" }}>
        <Box>
          <Flex align="center" gap="2" wrap="wrap">
            <Text fontWeight="semibold" color="brand.900">
              {tx("Registration decisions")}
            </Text>
            <Badge colorPalette={published ? "green" : "gray"}>{published ? tx("Published") : tx("Not published")}</Badge>
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {published
              ? tx("People who type their name on the check page see if they were accepted, and why when they were rejected.")
              : tx("Until you publish, people who check their registration only see that it arrived.")}
          </Text>
        </Box>
        <Button colorPalette={published ? "red" : "brand"} variant={published ? "outline" : "solid"} loading={loading} onClick={toggle} flexShrink={0}>
          {published ? <EyeOff size={16} aria-hidden /> : <Megaphone size={16} aria-hidden />}
          {published ? tx("Hide the decisions") : tx("Publish the decisions")}
        </Button>
      </Flex>
      <ShareLink url={`${origin}/check-registration`} message={`${GREETING}! ${tx("Check whether your Musabaqa registration was accepted with this link:")}`} />
    </>
  );

  if (!framed) return <Flex direction="column" gap="4">{body}</Flex>;
  return (
    <Card.Root mb="4">
      <Card.Body gap="4">{body}</Card.Body>
    </Card.Root>
  );
}
