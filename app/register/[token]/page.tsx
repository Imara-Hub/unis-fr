"use client";

import { useQuery } from "@apollo/client/react";
import {
  Box,
  Button,
  chakra,
  Checkbox,
  Circle,
  Flex,
  Heading,
  Image,
  Input,
  List,
  Separator,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Camera, Check, CircleCheck, IdCard, RefreshCw } from "lucide-react";
import NextImage from "next/image";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { readApiError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { REGISTRATION_LINK_STATUS, type Gender } from "@/lib/graphql/participants";
import {
  MAX_AGE,
  PASSPORT_RATIO,
  PhotoTooSmallError,
  preparePhoto,
  PROVINCES,
  registerParticipant,
  type RegistrationInput,
} from "@/lib/register";

type FormState = Omit<RegistrationInput, "gender"> & { gender: Gender | "" };

// ID card size (ISO ID-1, 85.6 x 54 mm): the shape of the ID document drop zone.
const ID_CARD_RATIO = 85.6 / 54;

const EMPTY: FormState = {
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  province: "",
  commune: "",
  institution: "",
};

// Fields that may stay empty.
const OPTIONAL: (keyof FormState)[] = ["middleName"];

// Error codes that belong to one field, so the message shows under that field.
const FIELD_OF_CODE: Record<string, keyof FormState | "photo" | "idDocument" | "acceptTerms"> = {
  ALREADY_REGISTERED: "phone",
  TERMS_CHANGED: "acceptTerms",
  INVALID_PHOTO: "photo",
  INVALID_ID_DOCUMENT: "idDocument",
};

// The competition banner above the form.
const banner = (
  <Box mx={{ base: "-1", md: "0" }}>
    <NextImage
      src="/form-banner.png"
      alt="Grand concours de mémorisation du Saint Coran au Burundi, 7e édition, 1448 H – 2027 M"
      width={1600}
      height={285}
      priority
      style={{ width: "100%", height: "auto" }}
    />
  </Box>
);

export default function RegisterPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Register />
    </Suspense>
  );
}

function Register() {
  const { token } = useParams<{ token: string }>();
  const { t, apiError } = useI18n();
  const tr = t.register;
  const status = useQuery(REGISTRATION_LINK_STATUS, { variables: { token }, fetchPolicy: "network-only" });
  const [done, setDone] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  // Only the first load: a refetch (new terms after TERMS_CHANGED) keeps the form and what was typed.
  if (status.loading && !status.data) return <FullPageSpinner />;
  if (status.error) {
    return (
      <AuthCard title={tr.errorTitle} top={banner}>
        <ErrorAlert message={apiError(readApiError(status.error)).message} />
      </AuthCard>
    );
  }

  const link = status.data?.registrationLinkStatus;
  if (!link?.valid) {
    return (
      <AuthCard title={tr.linkInvalidTitle} subtitle={tr.linkInvalidSubtitle} top={banner}>
        <Text color="fg.muted">{tr.linkInvalidHelp}</Text>
      </AuthCard>
    );
  }
  if (!link.open || closed) {
    return (
      <AuthCard title={tr.closedTitle} subtitle={tr.closedSubtitle} top={banner}>
        <Text color="fg.muted">{tr.closedHelp}</Text>
      </AuthCard>
    );
  }
  if (done) {
    return (
      <AuthCard title={tr.doneTitle} subtitle={tr.doneThanks(done)} top={banner}>
        <Stack gap="3">
          <Text>{tr.doneText}</Text>
          <Text color="fg.muted">{tr.doneClose}</Text>
        </Stack>
      </AuthCard>
    );
  }
  // The organisers have not written the terms yet: nobody can register until they do.
  if (!link.terms) {
    return (
      <AuthCard title={tr.notReadyTitle} subtitle={tr.notReadySubtitle} top={banner}>
        <Text color="fg.muted">{tr.notReadyHelp}</Text>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      wide
      top={banner}
      eyebrow={tr.eyebrow}
      title={tr.title}
      subtitle={tr.subtitle(MAX_AGE)}
    >
      <RegistrationForm
        token={token}
        terms={link.terms}
        onDone={setDone}
        onClosed={() => setClosed(true)}
        onTermsChanged={() => void status.refetch()}
      />
    </AuthCard>
  );
}

function RegistrationForm({
  token,
  terms,
  onDone,
  onClosed,
  onTermsChanged,
}: {
  token: string;
  terms: { text: string; version: number };
  onDone: (fullName: string) => void;
  onClosed: () => void;
  onTermsChanged: () => void;
}) {
  const { t, apiError } = useI18n();
  const tr = t.register;
  const [form, setForm] = useState<FormState>(EMPTY);
  // The terms version the person ticked "I accept" for. New terms (after TERMS_CHANGED) untick it.
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null);
  const accepted = acceptedVersion === terms.version;
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [idDocument, setIdDocument] = useState<Blob | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Free the preview image memory when it changes or the page closes.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  useEffect(() => {
    return () => {
      if (idPreview) URL.revokeObjectURL(idPreview);
    };
  }, [idPreview]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onPhotoChosen(file: File) {
    setFieldErrors(({ photo: _, ...rest }) => rest);
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setFieldErrors((f) => ({ ...f, photo: tr.errJpgPng }));
      return;
    }
    setPreparing(true);
    try {
      const prepared = await preparePhoto(file, { passport: true });
      setPhoto(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch (err) {
      setFieldErrors((f) => ({
        ...f,
        photo:
          err instanceof PhotoTooSmallError
            ? tr.errPhotoSmall
            : tr.errPhotoUnusable,
      }));
    } finally {
      setPreparing(false);
    }
  }

  async function onIdDocumentChosen(file: File) {
    setFieldErrors(({ idDocument: _, ...rest }) => rest);
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setFieldErrors((f) => ({ ...f, idDocument: tr.errJpgPng }));
      return;
    }
    setPreparingId(true);
    try {
      const prepared = await preparePhoto(file, { maxSide: 1600 }); // the text must stay readable
      setIdDocument(prepared);
      setIdPreview(URL.createObjectURL(prepared));
    } catch {
      setFieldErrors((f) => ({ ...f, idDocument: tr.errPhotoUnusable }));
    } finally {
      setPreparingId(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!photo) {
      setFieldErrors({ photo: tr.errAddPhoto });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!form.gender) {
      setFieldErrors({ gender: tr.errChooseOne });
      return;
    }
    if (!idDocument) {
      setFieldErrors({ idDocument: tr.errAddId });
      return;
    }
    if (!accepted) {
      setFieldErrors({ acceptTerms: tr.errAcceptTerms });
      return;
    }

    setSubmitting(true);
    const result = await registerParticipant(
      token,
      { ...form, gender: form.gender },
      { acceptTerms: accepted, termsVersion: terms.version },
      photo,
      idDocument,
    );
    setSubmitting(false);

    if ("fullName" in result) {
      onDone(result.fullName);
      return;
    }
    const failure = apiError(result);
    if (result.code === "LINK_INVALID" || result.code === "REGISTRATION_CLOSED" || result.code === "TERMS_NOT_SET") {
      onClosed();
      return;
    }
    if (result.code === "TERMS_CHANGED") {
      // Load the new text; the box is unticked because the version changed. The form keeps its data.
      onTermsChanged();
      setFieldErrors({ acceptTerms: failure.message });
      return;
    }
    const field = result.code ? FIELD_OF_CODE[result.code] : undefined;
    setFieldErrors(field ? { [field]: failure.message } : failure.fields);
    setError(field ? null : failure.message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const missing =
    (Object.keys(form) as (keyof FormState)[]).some((k) => !OPTIONAL.includes(k) && !form[k]) ||
    !photo ||
    !idDocument ||
    !accepted;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="7">
        <ErrorAlert message={error} />

        {/* 1. The photo first: it is the step people most often get wrong. */}
        <Section number={1} title={tr.sectionPhoto}>
          <PhotoPicker preview={preview} preparing={preparing} error={fieldErrors.photo} onFile={onPhotoChosen} />
        </Section>

        <Section number={2} title={tr.sectionAbout}>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
            <FormField label={tr.firstName} error={fieldErrors.firstName}>
              <Input autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
            </FormField>
            <FormField label={tr.middleName} required={false} error={fieldErrors.middleName} helper={tr.middleNameHelp}>
              <Input autoComplete="additional-name" value={form.middleName} onChange={set("middleName")} />
            </FormField>
            <FormField label={tr.lastName} error={fieldErrors.lastName}>
              <Input autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
            </FormField>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
            <FormField
              label={tr.phone}
              error={fieldErrors.phone}
              helper={tr.phoneHelp}
            >
              <Input type="tel" autoComplete="tel" placeholder="79 123 456" value={form.phone} onChange={set("phone")} />
            </FormField>
            <FormField
              label={tr.dateOfBirth}
              error={fieldErrors.dateOfBirth}
              helper={tr.dateOfBirthHelp(MAX_AGE)}
            >
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                min={oldestBirthIso()}
                max={todayIso()}
              />
            </FormField>
          </SimpleGrid>
          <FormField label={tr.gender} error={fieldErrors.gender}>
            <ChoicePicker
              label={tr.gender}
              options={[
                { value: "MALE" as Gender, label: tr.male },
                { value: "FEMALE" as Gender, label: tr.female },
              ]}
              columns={2}
              value={form.gender}
              invalid={Boolean(fieldErrors.gender)}
              onChange={(gender) => {
                setForm((f) => ({ ...f, gender }));
                setFieldErrors(({ gender: _, ...rest }) => rest);
              }}
            />
          </FormField>
        </Section>

        <Section number={3} title={tr.sectionAddress}>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
            <FormField label={tr.province} error={fieldErrors.province} helper={tr.provinceHelp}>
              <Input list="provinces" autoComplete="address-level1" value={form.province} onChange={set("province")} />
              {/* Suggestions while typing; any province can still be typed. */}
              <datalist id="provinces">
                {PROVINCES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </FormField>
            <FormField label={tr.commune} error={fieldErrors.commune}>
              <Input autoComplete="address-level2" value={form.commune} onChange={set("commune")} />
            </FormField>
          </SimpleGrid>
          <FormField label={tr.halaqa} error={fieldErrors.institution} helper={tr.halaqaHelp}>
            <Input value={form.institution} onChange={set("institution")} />
          </FormField>
        </Section>

        <Section number={4} title={tr.sectionId}>
          <IdDocumentPicker
            preview={idPreview}
            preparing={preparingId}
            error={fieldErrors.idDocument}
            onFile={onIdDocumentChosen}
          />
        </Section>

        <Section number={5} title={tr.sectionTerms}>
          <TermsBox
            text={terms.text}
            accepted={accepted}
            error={fieldErrors.acceptTerms}
            onChange={(checked) => {
              setAcceptedVersion(checked ? terms.version : null);
              setFieldErrors(({ acceptTerms: _, ...rest }) => rest);
            }}
          />
        </Section>

        <Button
          type="submit"
          colorPalette="brand"
          size="lg"
          loading={submitting}
          disabled={missing || preparing || preparingId}
        >
          {tr.submit}
        </Button>
      </Stack>
    </form>
  );
}

// The organisers' terms, to read before ticking "I accept". The organisers check every
// registration against them before the person may compete.
function TermsBox({
  text,
  accepted,
  error,
  onChange,
}: {
  text: string;
  accepted: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Stack gap="3">
      <Box
        tabIndex={0}
        aria-label={t.register.termsAria}
        maxH="64"
        overflowY="auto"
        p="4"
        rounded="lg"
        borderWidth="1px"
        borderColor={error ? "red.400" : "border"}
        bg="#F3F4F8"
        fontSize="sm"
        whiteSpace="pre-wrap"
        _focusVisible={{ outline: "2px solid", outlineColor: "brand.500" }}
      >
        {text}
      </Box>
      <Checkbox.Root
        checked={accepted}
        onCheckedChange={(e) => onChange(e.checked === true)}
        colorPalette="brand"
        invalid={Boolean(error)}
        alignItems="flex-start"
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control mt="0.5" />
        <Checkbox.Label fontWeight="medium">
          {t.register.acceptTerms}
        </Checkbox.Label>
      </Checkbox.Root>
      {error && (
        <Text fontSize="sm" color="fg.error" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  );
}

// The passport-shaped drop zone (35:45), with the rules beside it. Click, or drop a file on it.
function PhotoPicker({
  preview,
  preparing,
  error,
  onFile,
}: {
  preview: string | null;
  preparing: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const tr = useI18n().t.register;

  return (
    <Stack gap="2">
      <Flex gap={{ base: "5", md: "7" }} direction={{ base: "column", sm: "row" }} align={{ base: "center", sm: "flex-start" }}>
        <chakra.button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          aria-label={preview ? tr.photoChangeAria : tr.photoUploadAria}
          position="relative"
          w={{ base: "44", md: "48" }}
          aspectRatio={PASSPORT_RATIO}
          flexShrink={0}
          rounded="xl"
          overflow="hidden"
          cursor="pointer"
          borderWidth="2px"
          borderStyle={preview ? "solid" : "dashed"}
          borderColor={error ? "red.400" : dragging ? "brand.500" : preview ? "gold.400" : "brand.200"}
          bg={dragging ? "brand.50" : "#F3F4F8"}
          transition="border-color 0.15s, background 0.15s"
          _hover={{ borderColor: "brand.400" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "2px" }}
        >
          {preview ? (
            <>
              <Image src={preview} alt={tr.photoAlt} w="full" h="full" objectFit="cover" />
              <Flex
                position="absolute"
                insetX="0"
                bottom="0"
                justify="center"
                align="center"
                gap="1.5"
                py="2"
                bg="rgba(16,22,58,0.7)"
                color="white"
                fontSize="xs"
                fontWeight="semibold"
              >
                <RefreshCw size={13} aria-hidden />
                {tr.changePhoto}
              </Flex>
            </>
          ) : (
            <Stack align="center" justify="center" h="full" gap="2" px="3" textAlign="center" color="brand.700">
              {/* Face guide: where the head should sit in the frame. */}
              <Box
                position="absolute"
                top="14%"
                left="50%"
                transform="translateX(-50%)"
                w="52%"
                h="50%"
                rounded="full"
                borderWidth="1.5px"
                borderStyle="dashed"
                borderColor="brand.200"
                pointerEvents="none"
                aria-hidden
              />
              <Circle size="12" bg="white" color="brand.600" shadow="sm" position="relative" mt="10">
                <Camera size={22} strokeWidth={1.75} aria-hidden />
              </Circle>
              <Text fontSize="sm" fontWeight="semibold" position="relative">
                {preparing ? tr.preparing : tr.uploadPhoto}
              </Text>
              <Text fontSize="xs" color="fg.muted" position="relative">
                {tr.tapToChoose}
              </Text>
            </Stack>
          )}
        </chakra.button>

        <Stack gap="3" flex="1" minW="0">
          <Text fontSize="sm" color="fg.muted">
            {tr.photoIntro}
          </Text>
          <List.Root gap="1.5" variant="plain">
            {tr.photoRules.map((rule) => (
              <List.Item key={rule} fontSize="sm" color="fg">
                <List.Indicator asChild color={preview ? "green.600" : "gold.500"}>
                  {preview ? <CircleCheck size={16} /> : <Check size={16} />}
                </List.Indicator>
                {rule}
              </List.Item>
            ))}
          </List.Root>
          <Box>
            <Button size="sm" variant="outline" colorPalette="brand" loading={preparing} onClick={() => fileInput.current?.click()}>
              <Camera size={16} aria-hidden />
              {preview ? tr.changePhoto : tr.choosePhoto}
            </Button>
          </Box>
        </Stack>
      </Flex>

      {error && (
        <Text fontSize="sm" color="fg.error" role="alert">
          {error}
        </Text>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow choosing the same file again
          if (file) onFile(file);
        }}
      />
    </Stack>
  );
}

// Big cards to tap instead of a dropdown: quicker on a phone, and every choice visible.
// Arrow keys move between them, like radio buttons.
function ChoicePicker<T extends string>({
  label,
  options,
  columns,
  value,
  invalid,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  columns: number | Record<string, number>;
  value: T | "";
  invalid: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <SimpleGrid columns={columns} gap="3" w="full" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <chakra.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
              if (step) {
                e.preventDefault();
                const j = (i + step + options.length) % options.length;
                onChange(options[j]!.value);
                (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
              }
            }}
            display="flex"
            alignItems="center"
            gap="3"
            h="12"
            px="4"
            rounded="lg"
            borderWidth={selected ? "2px" : "1px"}
            borderColor={selected ? "brand.600" : invalid ? "red.400" : "#E6E8F0"}
            bg={selected ? "brand.50" : "#F3F4F8"}
            color="brand.900"
            fontWeight={selected ? "semibold" : "medium"}
            cursor="pointer"
            transition="border-color 0.15s, background 0.15s"
            _hover={{ borderColor: selected ? "brand.600" : "brand.300", bg: selected ? "brand.50" : "white" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "2px" }}
          >
            {/* Radio dot */}
            <Box
              w="4.5"
              h="4.5"
              rounded="full"
              flexShrink={0}
              borderWidth={selected ? "5px" : "2px"}
              borderColor={selected ? "brand.600" : "gray.400"}
              bg="white"
              transition="border-width 0.15s"
            />
            {o.label}
          </chakra.button>
        );
      })}
    </SimpleGrid>
  );
}

// The ID card (Karangamuntu) or passport: a card-shaped drop zone, the whole document visible.
function IdDocumentPicker({
  preview,
  preparing,
  error,
  onFile,
}: {
  preview: string | null;
  preparing: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const tr = useI18n().t.register;

  return (
    <Stack gap="2">
      <Flex gap={{ base: "5", md: "7" }} direction={{ base: "column", sm: "row" }} align={{ base: "center", sm: "flex-start" }}>
        <chakra.button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          aria-label={preview ? tr.idChangeAria : tr.idUploadAria}
          position="relative"
          w={{ base: "full", sm: "64" }}
          maxW="72"
          aspectRatio={ID_CARD_RATIO}
          flexShrink={0}
          rounded="xl"
          overflow="hidden"
          cursor="pointer"
          borderWidth="2px"
          borderStyle={preview ? "solid" : "dashed"}
          borderColor={error ? "red.400" : dragging ? "brand.500" : preview ? "gold.400" : "brand.200"}
          bg={dragging ? "brand.50" : "#F3F4F8"}
          transition="border-color 0.15s, background 0.15s"
          _hover={{ borderColor: "brand.400" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "2px" }}
        >
          {preview ? (
            <>
              <Image src={preview} alt={tr.idAlt} w="full" h="full" objectFit="contain" bg="#F3F4F8" />
              <Flex
                position="absolute"
                insetX="0"
                bottom="0"
                justify="center"
                align="center"
                gap="1.5"
                py="2"
                bg="rgba(16,22,58,0.7)"
                color="white"
                fontSize="xs"
                fontWeight="semibold"
              >
                <RefreshCw size={13} aria-hidden />
                {tr.changePhoto}
              </Flex>
            </>
          ) : (
            <Stack align="center" justify="center" h="full" gap="2" px="3" textAlign="center" color="brand.700">
              <Circle size="12" bg="white" color="brand.600" shadow="sm">
                <IdCard size={22} strokeWidth={1.75} aria-hidden />
              </Circle>
              <Text fontSize="sm" fontWeight="semibold">
                {preparing ? tr.preparing : tr.uploadId}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {tr.tapToChoose}
              </Text>
            </Stack>
          )}
        </chakra.button>

        <Stack gap="3" flex="1" minW="0">
          <Text fontSize="sm" color="fg.muted">
            {tr.idIntro}
          </Text>
          <List.Root gap="1.5" variant="plain">
            {tr.idRules.map((rule) => (
              <List.Item key={rule} fontSize="sm" color="fg">
                <List.Indicator asChild color={preview ? "green.600" : "gold.500"}>
                  {preview ? <CircleCheck size={16} /> : <Check size={16} />}
                </List.Indicator>
                {rule}
              </List.Item>
            ))}
          </List.Root>
          <Box>
            <Button size="sm" variant="outline" colorPalette="brand" loading={preparing} onClick={() => fileInput.current?.click()}>
              <IdCard size={16} aria-hidden />
              {preview ? tr.changePhoto : tr.choosePhoto}
            </Button>
          </Box>
        </Stack>
      </Flex>

      {error && (
        <Text fontSize="sm" color="fg.error" role="alert">
          {error}
        </Text>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow choosing the same file again
          if (file) onFile(file);
        }}
      />
    </Stack>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <Stack gap="4">
      <Stack gap="2">
        <Flex align="center" gap="3">
          <Circle size="7" bg="brand.900" color="gold.300" fontSize="sm" fontWeight="semibold">
            {number}
          </Circle>
          <Heading as="h2" fontFamily="display" fontSize="lg" color="brand.900">
            {title}
          </Heading>
        </Flex>
        <Separator borderColor="gold.200" />
      </Stack>
      {children}
    </Stack>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);
// The earliest birthday that is still MAX_AGE or younger today.
const oldestBirthIso = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - MAX_AGE - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
