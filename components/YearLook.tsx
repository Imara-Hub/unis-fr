"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Box, Button, Flex, Grid, Input, Stack, Text } from "@chakra-ui/react";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { editionLine } from "@/components/brand/YearBanner";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { toaster } from "@/components/Toaster";
import { uploadBanner } from "@/lib/account";
import { apiUrl } from "@/lib/api";
import { readApiError } from "@/lib/errors";
import { BRANDING, REMOVE_BANNER, SEASONS, UPDATE_BRANDING } from "@/lib/graphql/seasons";
import { useI18n } from "@/lib/i18n";
import { useViewedSeason } from "@/lib/season";

const MAX_BYTES = 2 * 1024 * 1024;

// "" = cleared; otherwise a whole number.
const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));

// The admin sets how the current year presents itself: the edition line of the public pages
// (registration, results) and the banner printed at the top of the forms and the results sheet.
export function YearLook() {
  const { tx } = useI18n();
  const client = useApolloClient();
  const viewed = useViewedSeason();
  // Fresh each time: a public page in this tab may have loaded the current year's look meanwhile.
  const { data, error } = useQuery(BRANDING, { fetchPolicy: "network-only" });
  const seasons = useQuery(SEASONS);
  const current = seasons.data?.seasons.find((s) => s.current)?.year ?? null;
  // Locked until the years are known: never editable, even for a moment, on a past year.
  const lookingBack = current === null || (viewed !== null && viewed !== current);

  const [edition, setEdition] = useState("");
  const [hijri, setHijri] = useState("");
  const [gregorian, setGregorian] = useState("");
  const loadedYear = useRef<number | null>(null);
  const b = data?.branding;
  useEffect(() => {
    if (!b || loadedYear.current === b.year) return;
    loadedYear.current = b.year;
    setEdition(b.edition?.toString() ?? "");
    setHijri(b.hijriYear?.toString() ?? "");
    setGregorian(b.gregorianYear?.toString() ?? "");
  }, [b]);

  const [save, saving] = useMutation(UPDATE_BRANDING);
  const [remove, removing] = useMutation(REMOVE_BANNER);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!b) return error ? <ErrorAlert message={readApiError(error).message} /> : <Text color="fg.muted">{tx("Loading…")}</Text>;

  const numbers = [edition, hijri, gregorian].map(toNumber);
  const invalid = numbers.some((n) => n !== null && !Number.isInteger(n));
  const preview = editionLine({ edition: numbers[0], hijriYear: numbers[1], gregorianYear: numbers[2] });

  async function onSave() {
    try {
      await save({ variables: { input: { edition: numbers[0], hijriYear: numbers[1], gregorianYear: numbers[2] } } });
      toaster.create({ type: "success", title: tx("Saved") });
    } catch (err) {
      toaster.create({ type: "error", title: readApiError(err).message });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES || !/^image\/(png|jpeg)$/.test(file.type)) {
      toaster.create({ type: "error", title: tx("The banner must be a JPG or PNG image of at most 2 MB.") });
      return;
    }
    setUploading(true);
    const res = await uploadBanner(file);
    setUploading(false);
    if ("message" in res) {
      toaster.create({ type: "error", title: res.message });
      return;
    }
    await client.refetchQueries({ include: [BRANDING, SEASONS] });
    toaster.create({ type: "success", title: tx("Banner updated") });
  }

  async function onRemove() {
    try {
      await remove();
      await client.refetchQueries({ include: [SEASONS] });
    } catch (err) {
      toaster.create({ type: "error", title: readApiError(err).message });
    }
  }

  const locked = lookingBack;
  return (
    <Stack gap="6">
      {locked && current !== null && <Text fontSize="sm" color="fg.muted">{tx("This is a closed year: its look is kept as it was.")}</Text>}

      <Stack gap="3">
        <Text fontWeight="semibold">{tx("Edition line")}</Text>
        <Text fontSize="sm" color="fg.muted">
          {tx("Shown under the title on the registration and results pages.")}
        </Text>
        <Grid templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap="3">
          <FormField label={tx("Edition")} required={false}>
            <Input inputMode="numeric" value={edition} disabled={locked} placeholder="7" onChange={(e) => setEdition(e.target.value)} />
          </FormField>
          <FormField label={tx("Hijri year")} required={false}>
            <Input inputMode="numeric" value={hijri} disabled={locked} placeholder="1448" onChange={(e) => setHijri(e.target.value)} />
          </FormField>
          <FormField label={tx("Gregorian year")} required={false}>
            <Input inputMode="numeric" value={gregorian} disabled={locked} placeholder="2027" onChange={(e) => setGregorian(e.target.value)} />
          </FormField>
        </Grid>
        <Flex align="center" justify="space-between" gap="3" wrap="wrap">
          <Text fontSize="sm" fontWeight="semibold" letterSpacing="0.18em" color="gold.600">
            {preview ?? tx("(no line)")}
          </Text>
          {!locked && (
            <Button colorPalette="brand" size="sm" onClick={onSave} loading={saving.loading} disabled={invalid}>
              <Save size={16} aria-hidden />
              {tx("Save")}
            </Button>
          )}
        </Flex>
      </Stack>

      <Stack gap="3">
        <Text fontWeight="semibold">{tx("Banner of the printed forms")}</Text>
        <Text fontSize="sm" color="fg.muted">
          {tx("At the top of the registration form and the results sheet. A wide JPG or PNG (e.g. 1600 × 285), at most 2 MB.")}
        </Text>
        <Box borderWidth="1px" borderColor="border" rounded="md" p="3" bg="white">
          {b.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apiUrl(b.bannerUrl)} alt={tx("Banner of the printed forms")} style={{ width: "100%", height: "auto", display: "block" }} />
          ) : (
            <Text fontSize="sm" color="fg.muted" textAlign="center" py="4">
              {tx("No banner: the forms show the plain competition title.")}
            </Text>
          )}
        </Box>
        {!locked && (
          <Flex gap="2" wrap="wrap">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button colorPalette="brand" size="sm" onClick={() => fileInput.current?.click()} loading={uploading}>
              <ImagePlus size={16} aria-hidden />
              {b.bannerUrl ? tx("Replace the banner") : tx("Upload a banner")}
            </Button>
            {b.bannerUrl && (
              <Button variant="outline" colorPalette="red" size="sm" onClick={onRemove} loading={removing.loading}>
                <Trash2 size={16} aria-hidden />
                {tx("Remove")}
              </Button>
            )}
          </Flex>
        )}
      </Stack>
    </Stack>
  );
}
