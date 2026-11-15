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
import { Camera, Check, CircleCheck, CloudOff, IdCard, RefreshCw, UserPlus } from "lucide-react";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { BirthDatePicker } from "@/components/BirthDatePicker";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CompetitionBand } from "@/components/brand/CompetitionTitle";
import { FormField } from "@/components/FormField";
import { readApiError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import {
  GUARDIAN_RELATIONS,
  REGISTRAR_INSTITUTION_TYPES,
  REGISTRATION_LINK_STATUS,
  type Gender,
  type GuardianRelation,
  type RegisteredBy,
  type RegistrarInstitutionType,
} from "@/lib/graphql/participants";
import {
  MAX_AGE,
  PASSPORT_RATIO,
  PhotoTooSmallError,
  preparePhoto,
  PROVINCES,
  registerParticipant,
  type RegistrationInput,
} from "@/lib/register";
import {
  queuedRegistrations,
  queueRegistration,
  isWaiting,
  removeQueued,
  resendWithTerms,
  sendQueued,
  type QueuedRegistration,
} from "@/lib/registrationOutbox";

// The registrar's details are flat fields here, sent as `contact` (see toInput).
// One "full name" box: split into first name and last name when sent (see splitName).
type FormState = Omit<RegistrationInput, "firstName" | "middleName" | "lastName" | "gender" | "registeredBy" | "contact"> & {
  fullName: string;
  gender: Gender | "";
  registeredBy: RegisteredBy | "";
  contactName: string;
  contactPhone: string;
  contactRelation: GuardianRelation | "";
  contactInstitutionType: RegistrarInstitutionType | "";
  contactInstitutionName: string;
};

// ID card size (ISO ID-1, 85.6 x 54 mm): the shape of the ID document drop zone.
const ID_CARD_RATIO = 85.6 / 54;

const EMPTY: FormState = {
  fullName: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  province: "",
  commune: "",
  institution: "",
  institutionLocation: "",
  registeredBy: "",
  contactName: "",
  contactPhone: "",
  contactRelation: "",
  contactInstitutionType: "",
  contactInstitutionName: "",
};

// What must be filled in depends on who fills in the form.
function requiredFields(f: FormState): (keyof FormState)[] {
  const always: (keyof FormState)[] = ["registeredBy", "fullName", "dateOfBirth", "gender", "province", "commune", "institution", "institutionLocation"];
  if (f.registeredBy === "SELF") return [...always, "phone"];
  if (f.registeredBy === "GUARDIAN") return [...always, "contactName", "contactPhone", "contactRelation"];
  if (f.registeredBy === "INSTITUTION") {
    return [...always, "contactInstitutionType", "contactInstitutionName", "contactName", "contactPhone"];
  }
  return always;
}

// "Jean Claude Ndayishimiye" → first name "Jean", last name "Claude Ndayishimiye".
// Null when there are not at least two words.
function splitName(fullName: string): { firstName: string; lastName: string } | null {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}

function toInput(f: FormState): RegistrationInput {
  const { fullName, contactName, contactPhone, contactRelation, contactInstitutionType, contactInstitutionName, ...rest } = f;
  const registeredBy = f.registeredBy || "SELF";
  const name = splitName(fullName) ?? { firstName: fullName.trim(), lastName: "" };
  return {
    ...rest,
    ...name,
    phone: registeredBy === "SELF" ? f.phone : "",
    gender: f.gender as Gender,
    registeredBy,
    contact:
      registeredBy === "SELF"
        ? null
        : {
            name: contactName,
            phone: contactPhone,
            relation: registeredBy === "GUARDIAN" ? contactRelation || null : null,
            institutionType: registeredBy === "INSTITUTION" ? contactInstitutionType || null : null,
            institutionName: registeredBy === "INSTITUTION" ? contactInstitutionName.trim() || null : null,
          },
  };
}

// The server's field names for the registrar ("contact.name") → this form's fields.
const CONTACT_FIELDS: Record<string, keyof FormState> = {
  firstName: "fullName",
  middleName: "fullName",
  lastName: "fullName",
  "contact.name": "contactName",
  "contact.phone": "contactPhone",
  "contact.relation": "contactRelation",
  "contact.institutionType": "contactInstitutionType",
  "contact.institutionName": "contactInstitutionName",
};

// After a guardian or an institution registers one participant, the next form starts with their
// details (and the address and halaqa, usually the same), so only the new participant is typed.
function keptForNext(f: FormState): Partial<FormState> {
  if (f.registeredBy === "SELF" || !f.registeredBy) return {};
  const { registeredBy, contactName, contactPhone, contactRelation, contactInstitutionType, contactInstitutionName, province, commune, institution, institutionLocation } = f;
  return { registeredBy, contactName, contactPhone, contactRelation, contactInstitutionType, contactInstitutionName, province, commune, institution, institutionLocation };
}

// Error codes that belong to one field, so the message shows under that field.
// (ALREADY_REGISTERED is about the person, name and date of birth: shown above the form.)
const FIELD_OF_CODE: Record<string, keyof FormState | "photo" | "idDocument" | "acceptTerms"> = {
  TERMS_CHANGED: "acceptTerms",
  INVALID_PHOTO: "photo",
  INVALID_ID_DOCUMENT: "idDocument",
};

// The competition banner above the form.
const banner = <CompetitionBand />;

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
  // `queued`: no connection, the registration waits on this phone and is sent by itself.
  const [done, setDone] = useState<{ fullName: string; keep: Partial<FormState>; queued?: boolean } | null>(null);
  const queue = useRegistrationQueue(token);
  // Details carried over to the next form ("Register another participant"), and a fresh form each time.
  const [prefill, setPrefill] = useState<Partial<FormState>>({});
  const [round, setRound] = useState(0);
  const [closed, setClosed] = useState(false);

  // Only the first load: a refetch (new terms after TERMS_CHANGED) keeps the form and what was typed.
  if (status.loading && !status.data) return <FullPageSpinner />;
  const notice = <QueueNotice queue={queue} terms={status.data?.registrationLinkStatus.terms ?? null} />;
  if (status.error && !status.data) {
    return (
      <AuthCard title={tr.errorTitle} top={banner}>
        <Stack gap="4">
          {notice}
          <ErrorAlert message={apiError(readApiError(status.error)).message} />
        </Stack>
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
    const forSomeone = Boolean(done.keep.registeredBy);
    return (
      <AuthCard
        title={done.queued ? tr.queuedTitle : tr.doneTitle}
        subtitle={done.queued ? tr.queuedSubtitle(done.fullName) : forSomeone ? tr.doneOther(done.fullName) : tr.doneThanks(done.fullName)}
        top={banner}
      >
        <Stack gap="4">
          {notice}
          <Text>{done.queued ? tr.queuedText : forSomeone ? tr.doneTextOther : tr.doneText}</Text>
          {forSomeone ? (
            <Stack gap="2" align="flex-start">
              <Button
                colorPalette="brand"
                size="lg"
                onClick={() => {
                  setPrefill(done.keep);
                  setRound((r) => r + 1);
                  setDone(null);
                  window.scrollTo({ top: 0 });
                }}
              >
                <UserPlus size={18} aria-hidden />
                {tr.registerAnother}
              </Button>
              <Text fontSize="sm" color="fg.muted">
                {tr.registerAnotherHelp}
              </Text>
            </Stack>
          ) : done.queued ? null : (
            <Text color="fg.muted">{tr.doneClose}</Text>
          )}
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
      <Box mb={queue.items.length || queue.sent.length ? "6" : undefined}>{notice}</Box>
      <RegistrationForm
        key={round}
        token={token}
        terms={link.terms}
        initial={prefill}
        onDone={(fullName, keep) => setDone({ fullName, keep })}
        onQueued={(fullName, keep) => {
          setDone({ fullName, keep, queued: true });
          void queue.refresh();
        }}
        onClosed={() => setClosed(true)}
        onTermsChanged={() => void status.refetch()}
      />
    </AuthCard>
  );
}

// Registrations saved on this phone while there was no connection: sent by themselves when the page
// opens, when the connection returns and every 20 seconds while it stays open.
function useRegistrationQueue(token: string) {
  const [items, setItems] = useState<QueuedRegistration[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const busy = useRef(false);

  const refresh = useCallback(async () => setItems(await queuedRegistrations(token)), [token]);
  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (const item of await queuedRegistrations(token)) {
        if (!isWaiting(item)) continue; // refused: waits for the person (see QueueNotice)
        const { outcome } = await sendQueued(item);
        if (outcome === "sent") setSent((s) => [...s, item.fullName]);
        if (outcome === "waiting") break; // no connection or too busy: the next ones would fail too
      }
    } finally {
      busy.current = false;
      await refresh();
    }
  }, [token, refresh]);

  useEffect(() => {
    void flush();
    const timer = setInterval(() => void flush(), 20_000);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  async function resend(item: QueuedRegistration, terms: { version: number }) {
    const { outcome } = await resendWithTerms(item, { acceptTerms: true, termsVersion: terms.version });
    if (outcome === "sent") setSent((s) => [...s, item.fullName]);
    await refresh();
  }
  async function remove(item: QueuedRegistration) {
    await removeQueued(item.id!);
    await refresh();
  }

  return { items, sent, refresh, resend, remove };
}

function QueueNotice({
  queue,
  terms,
}: {
  queue: ReturnType<typeof useRegistrationQueue>;
  terms: { text: string; version: number } | null;
}) {
  const { t, apiError } = useI18n();
  const tr = t.register;
  const [sending, setSending] = useState<number | null>(null);
  const waiting = queue.items.filter(isWaiting);
  const refused = queue.items.filter((i) => !isWaiting(i));
  if (!waiting.length && !refused.length && !queue.sent.length) return null;

  return (
    <Stack gap="3">
      {queue.sent.length > 0 && (
        <Flex align="center" gap="3" px="4" py="3" rounded="xl" bg="green.50" borderWidth="1px" borderColor="green.200" color="green.900" role="status">
          <CircleCheck size={18} aria-hidden style={{ flexShrink: 0 }} />
          <Text fontSize="sm" fontWeight="medium">
            {tr.queueSent(queue.sent.join(", "))}
          </Text>
        </Flex>
      )}
      {waiting.length > 0 && (
        <Flex align="center" gap="3" px="4" py="3" rounded="xl" bg="orange.50" borderWidth="1px" borderColor="orange.200" color="orange.900" role="status">
          <CloudOff size={18} aria-hidden style={{ flexShrink: 0 }} />
          <Text fontSize="sm" fontWeight="medium">
            {tr.queueWaiting(waiting.map((i) => i.fullName).join(", "))}
          </Text>
        </Flex>
      )}
      {refused.map((item) => {
        const newTerms = item.refused?.code === "TERMS_CHANGED" ? terms : null;
        return (
          <Stack key={item.id} gap="3" px="4" py="3" rounded="xl" bg="red.50" borderWidth="1px" borderColor="red.200" color="red.900">
            <Text fontSize="sm" fontWeight="medium">
              {tr.queueRefused(item.fullName, apiError({ code: item.refused?.code, message: item.refused?.message ?? "", fields: {} }).message)}
            </Text>
            {newTerms ? (
              <>
                <Text fontSize="sm">{tr.queueTermsChanged}</Text>
                <Box maxH="48" overflowY="auto" p="3" rounded="md" bg="white" borderWidth="1px" fontSize="sm" color="fg" whiteSpace="pre-wrap">
                  {newTerms.text}
                </Box>
              </>
            ) : (
              <Text fontSize="sm">{tr.queueRefusedHelp}</Text>
            )}
            <Flex gap="2" wrap="wrap">
              {newTerms && (
                <Button
                  size="sm"
                  colorPalette="brand"
                  loading={sending === item.id}
                  onClick={async () => {
                    setSending(item.id!);
                    await queue.resend(item, newTerms);
                    setSending(null);
                  }}
                >
                  {tr.queueAcceptSend}
                </Button>
              )}
              <Button size="sm" variant="outline" colorPalette="red" disabled={sending === item.id} onClick={() => void queue.remove(item)}>
                {tr.queueRemove}
              </Button>
            </Flex>
          </Stack>
        );
      })}
    </Stack>
  );
}

function RegistrationForm({
  token,
  terms,
  initial,
  onDone,
  onQueued,
  onClosed,
  onTermsChanged,
}: {
  token: string;
  terms: { text: string; version: number };
  initial: Partial<FormState>;
  onDone: (fullName: string, keep: Partial<FormState>) => void;
  onQueued: (fullName: string, keep: Partial<FormState>) => void;
  onClosed: () => void;
  onTermsChanged: () => void;
}) {
  const { t, apiError, locale } = useI18n();
  const tr = t.register;
  const [form, setForm] = useState<FormState>({ ...EMPTY, ...initial });
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
  const choose = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors(({ [key]: _, ...rest }) => rest);
  };
  // The halaqa is usually the school / masjid / markaz itself: filled in along, until changed.
  const setInstitutionName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      contactInstitutionName: value,
      institution: f.institution === f.contactInstitutionName ? value : f.institution,
    }));
  };
  const by = form.registeredBy;

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
    if (!form.registeredBy) {
      setFieldErrors({ registeredBy: tr.errChooseOne });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (form.registeredBy === "GUARDIAN" && !form.contactRelation) {
      setFieldErrors({ contactRelation: tr.errChooseOne });
      return;
    }
    if (form.registeredBy === "INSTITUTION" && !form.contactInstitutionType) {
      setFieldErrors({ contactInstitutionType: tr.errChooseOne });
      return;
    }
    if (!splitName(form.fullName)) {
      setFieldErrors({ fullName: tr.errFullName });
      return;
    }
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
    const input = toInput(form);
    const acceptance = { acceptTerms: accepted, termsVersion: terms.version };
    const result = await registerParticipant(token, input, acceptance, photo, idDocument);

    if ("fullName" in result) {
      setSubmitting(false);
      onDone(result.fullName, keptForNext(form));
      return;
    }
    // No connection (no answer, so no error code): keep it on the phone, it is sent by itself.
    if (!result.code) {
      const fullName = `${input.firstName} ${input.lastName}`;
      const kept = await queueRegistration({ token, fullName, input, terms: acceptance, photo, idDocument });
      setSubmitting(false);
      if (kept) {
        onQueued(fullName, keptForNext(form));
        return;
      }
    }
    setSubmitting(false);
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
    const fields = Object.fromEntries(Object.entries(failure.fields).map(([k, v]) => [CONTACT_FIELDS[k] ?? k, v]));
    setFieldErrors(field ? { [field]: failure.message } : fields);
    setError(field ? null : failure.message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const missing =
    requiredFields(form).some((k) => !form[k]) ||
    !photo ||
    !idDocument ||
    !accepted;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="7">
        <ErrorAlert message={error} />

        {/* 1. Who fills in the form: the participant, a parent / guardian, or a school / masjid / markaz. */}
        <Section number={1} title={tr.sectionWho}>
          <FormField label={tr.whoLabel} error={fieldErrors.registeredBy}>
            <ChoicePicker
              label={tr.whoLabel}
              options={[
                { value: "SELF" as RegisteredBy, label: tr.whoSelf },
                { value: "GUARDIAN" as RegisteredBy, label: tr.whoGuardian },
                { value: "INSTITUTION" as RegisteredBy, label: tr.whoInstitution },
              ]}
              columns={{ base: 1, md: 3 }}
              value={by}
              invalid={Boolean(fieldErrors.registeredBy)}
              onChange={(value) => choose("registeredBy", value)}
            />
          </FormField>

          {by === "GUARDIAN" && (
            <Stack gap="4" animation="fade-in 0.25s ease-out" _motionReduce={{ animation: "none" }}>
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                <FormField label={tr.guardianName} error={fieldErrors.contactName}>
                  <Input autoComplete="name" value={form.contactName} onChange={set("contactName")} />
                </FormField>
                <FormField label={tr.guardianPhone} error={fieldErrors.contactPhone} helper={tr.guardianPhoneHelp}>
                  <Input type="tel" autoComplete="tel" placeholder="79 123 456" value={form.contactPhone} onChange={set("contactPhone")} />
                </FormField>
              </SimpleGrid>
              <FormField label={tr.relation} error={fieldErrors.contactRelation}>
                <ChoicePicker
                  label={tr.relation}
                  options={GUARDIAN_RELATIONS.map((r) => ({ value: r, label: tr.relations[r] }))}
                  columns={{ base: 2, md: 4 }}
                  value={form.contactRelation}
                  invalid={Boolean(fieldErrors.contactRelation)}
                  onChange={(value) => choose("contactRelation", value)}
                />
              </FormField>
            </Stack>
          )}

          {by === "INSTITUTION" && (
            <Stack gap="4" animation="fade-in 0.25s ease-out" _motionReduce={{ animation: "none" }}>
              <FormField label={tr.institutionType} error={fieldErrors.contactInstitutionType}>
                <ChoicePicker
                  label={tr.institutionType}
                  options={REGISTRAR_INSTITUTION_TYPES.map((t) => ({ value: t, label: tr.institutionTypes[t] }))}
                  columns={3}
                  value={form.contactInstitutionType}
                  invalid={Boolean(fieldErrors.contactInstitutionType)}
                  onChange={(value) => choose("contactInstitutionType", value)}
                />
              </FormField>
              <FormField label={tr.institutionName} error={fieldErrors.contactInstitutionName}>
                <Input autoComplete="organization" value={form.contactInstitutionName} onChange={setInstitutionName} />
              </FormField>
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                <FormField label={tr.contactName} error={fieldErrors.contactName}>
                  <Input autoComplete="name" value={form.contactName} onChange={set("contactName")} />
                </FormField>
                <FormField label={tr.contactPhone} error={fieldErrors.contactPhone} helper={tr.contactPhoneHelp}>
                  <Input type="tel" autoComplete="tel" placeholder="79 123 456" value={form.contactPhone} onChange={set("contactPhone")} />
                </FormField>
              </SimpleGrid>
            </Stack>
          )}
        </Section>

        {/* 2. The photo early: it is the step people most often get wrong. */}
        <Section number={2} title={tr.sectionPhoto}>
          <PhotoPicker preview={preview} preparing={preparing} error={fieldErrors.photo} onFile={onPhotoChosen} />
        </Section>

        <Section number={3} title={by && by !== "SELF" ? tr.sectionAboutParticipant : tr.sectionAbout}>
          <FormField label={tr.fullName} error={fieldErrors.fullName} helper={tr.fullNameHelp}>
            <Input
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => {
                set("fullName")(e);
                setFieldErrors(({ fullName: _, ...rest }) => rest);
              }}
            />
          </FormField>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
            {/* One number per registration: a parent or school gives only theirs, above. */}
            {(!by || by === "SELF") && (
              <FormField label={tr.phone} error={fieldErrors.phone} helper={tr.phoneHelp}>
                <Input type="tel" autoComplete="tel" placeholder="79 123 456" value={form.phone} onChange={set("phone")} />
              </FormField>
            )}
            <FormField
              label={tr.dateOfBirth}
              error={fieldErrors.dateOfBirth}
              helper={tr.dateOfBirthHelp(MAX_AGE)}
            >
              <BirthDatePicker
                value={form.dateOfBirth}
                onChange={(dateOfBirth) => choose("dateOfBirth", dateOfBirth)}
                min={oldestBirthIso()}
                max={todayIso()}
                locale={locale[0]}
                placeholder={tr.dateOfBirthPlaceholder}
                labels={{ openCalendar: tr.openCalendar, month: tr.month, year: tr.year }}
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

        <Section number={4} title={by && by !== "SELF" ? tr.sectionAddressParticipant : tr.sectionAddress}>
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
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
            <FormField label={tr.halaqa} error={fieldErrors.institution} helper={tr.halaqaHelp}>
              <Input value={form.institution} onChange={set("institution")} />
            </FormField>
            <FormField label={tr.halaqaLocation} error={fieldErrors.institutionLocation} helper={tr.halaqaLocationHelp}>
              <Input value={form.institutionLocation} onChange={set("institutionLocation")} />
            </FormField>
          </SimpleGrid>
        </Section>

        <Section number={5} title={tr.sectionId}>
          <IdDocumentPicker
            preview={idPreview}
            preparing={preparingId}
            error={fieldErrors.idDocument}
            onFile={onIdDocumentChosen}
          />
        </Section>

        <Section number={6} title={tr.sectionTerms}>
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

// Today in the phone's own time zone (toISOString would give the UTC date, a day off at night).
const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// The earliest birthday that is still MAX_AGE or younger today.
const oldestBirthIso = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - MAX_AGE - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
