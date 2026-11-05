"use client";

import { Global } from "@emotion/react";
import { Box, Flex, Grid, Heading, Image, Text } from "@chakra-ui/react";
import { Mail, MapPin, Phone } from "lucide-react";
import NextImage from "next/image";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { useRegistrar } from "@/components/Registrar";
import { apiUrl } from "@/lib/api";
import type { ParticipantDetail } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";

// The paper registration form (A4), filled in with a participant's registration, or blank to fill
// in by hand. Printing it (or "Save as PDF" in the print window) gives exactly one A4 page.
// The declaration is the terms and conditions the person accepted on the online form (with the date).

const NAVY = "#1F2B5B";
const LINE = "#9AA0B4";

// Print: one A4 page, no browser margins, colours kept (navy footer, photo box).
export function PrintStyles() {
  return (
    <Global
      styles={{
        "@page": { size: "A4", margin: 0 },
        "@media print": {
          "html, body": { background: "white !important" },
          ".no-print": { display: "none !important" },
          ".sheet-frame": { padding: "0 !important", overflow: "visible !important" },
          ".sheet": { boxShadow: "none !important", margin: "0 !important" },
        },
      }}
    />
  );
}

export function RegistrationSheet({ participant: p }: { participant: ParticipantDetail | null }) {
  const { tx } = useI18n();
  const registrar = useRegistrar();
  const contact = p?.contact ?? null;
  const byInstitution = p?.registeredBy === "INSTITUTION";
  const byGuardian = p?.registeredBy === "GUARDIAN";
  // The guardian's relationship, or "Leader" for the person responsible at the school / masjid / markaz.
  const relation = byGuardian && contact?.relation ? registrar.relation(contact.relation) : byInstitution ? tx("Leader") : "";
  // Filled in: the registration's answers as plain text, empty lines left out. Blank: boxes to write in.
  const filled = Boolean(p);
  // Who to call: the contact who registered them, or the guardian of people registered before.
  const emergency = contact ?? (p?.guardianName ? { name: p.guardianName, phone: p.guardianPhone ?? "" } : null);

  return (
    <Box
      className="sheet"
      position="relative"
      w="210mm"
      h="297mm"
      mx="auto"
      bg="white"
      color="#1B1F33"
      overflow="hidden"
      boxShadow="0 10px 40px rgba(16,22,58,0.18)"
      fontSize="11.5pt"
      css={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      {/* The soft rounded shape in the background, bottom left. */}
      <Box
        position="absolute"
        left="-40mm"
        top="175mm"
        w="140mm"
        h="110mm"
        rounded="18mm"
        bg="#F4F5F9"
        transform="rotate(-38deg)"
        aria-hidden
      />

      <Box position="relative" px="14mm" pt="9mm">
        {/* Banner and title on the left, the passport photo on the right */}
        <Flex justify="space-between" align="flex-start" gap="8mm">
          <Box w="112mm" flexShrink={0}>
            <NextImage src="/form-banner.png" alt="" width={1600} height={285} priority style={{ width: "100%", height: "auto" }} />
            <Heading
              as="h1"
              mt="9mm"
              ps="3mm"
              fontSize="25pt"
              fontWeight="bold"
              color={NAVY}
              textDecoration="underline"
              textUnderlineOffset="5px"
              textDecorationThickness="2px"
              letterSpacing="0.01em"
            >
              {tx("REGISTRATION FORM")}
            </Heading>
          </Box>
          <Box w="37mm" h="47mm" bg={NAVY} flexShrink={0} overflow="hidden">
            {p && (
              <Image
                src={apiUrl(p.photoUrl)}
                alt=""
                w="full"
                h="full"
                objectFit="cover"
                // A photo that cannot load leaves the plain navy box, as on the paper form.
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
            )}
          </Box>
        </Flex>

        {/* Participant */}
        <SectionTitle mt="3mm">
          {tx("Participant details")}&nbsp; N°{" "}
          {p?.number ? (
            <Text as="span" color={NAVY}>
              {p.number}
            </Text>
          ) : (
            <Dots />
          )}
        </SectionTitle>
        <Rows>
          <Line filled={filled} label={tx("Full name")} value={p?.fullName} />
          {filled ? (
            <>
              <Line filled label={tx("Date of birth")} value={p ? formatDayNumeric(p.dateOfBirth) : null} />
              <Line filled label={tx("Gender")} value={p ? (p.gender === "MALE" ? tx("Boy") : tx("Girl")) : null} />
            </>
          ) : (
            <Row label={tx("Date of birth")} plain>
              <Flex align="center" justify="space-between" w="full" gap="4mm">
                <DateBoxes />
                <Flex align="center" gap="4mm" flexShrink={0}>
                  <Text>{tx("Gender")} :</Text>
                  <Radio checked={false}>{tx("Boy")}</Radio>
                  <Radio checked={false}>{tx("Girl")}</Radio>
                </Flex>
              </Flex>
            </Row>
          )}
          <Line filled={filled} label={tx("Where they live")} value={p ? `${p.commune}, ${p.province}` : null} />
          <Line filled={filled} label={tx("Phone number")} value={p?.phone ? formatPhone(p.phone) : null} />
        </Rows>

        {/* Madrassa / Halaqah / Markaz */}
        <SectionTitle mt="7mm">Madrassa / Halaqah / Markaz</SectionTitle>
        <Rows>
          <Line filled={filled} label={tx("Name")} value={p?.institution} />
          <Line filled={filled} label={tx("Location")} value={p?.institutionLocation} />
          <Line filled={filled} label={tx("Leader / Director")} value={byInstitution ? contact?.name : null} />
          <Line filled={filled} label={tx("Phone number")} value={byInstitution && contact ? formatPhone(contact.phone) : null} />
        </Rows>

        {/* Emergency contact: the parent or the leader who registered them. Left out when there is none. */}
        {(!filled || emergency) && (
          <>
            <SectionTitle mt="9mm">
              {tx("Emergency contact")} :&nbsp; {tx("Leader / Teacher / Parent / Relative")}
            </SectionTitle>
            <Rows>
              <Line filled={filled} label={tx("Full name")} value={emergency?.name} />
              <Line filled={filled} label={tx("Relationship")} value={relation || null} />
              <Line filled={filled} label={tx("Phone number")} value={emergency?.phone ? formatPhone(emergency.phone) : null} />
            </Rows>
          </>
        )}

        {/* UNIS badge, declaration, signature and date */}
        <Grid templateColumns="1fr 108mm" mt="5mm" alignItems="end">
          <Box ps="6mm" pb="2mm">
            <Logo size={110} />
          </Box>
          <Box pb="4mm">
            {/* The terms and conditions ticked on the online form are the declaration: no signature. */}
            <Flex gap="3mm" align="flex-start" fontStyle="italic" fontSize="10.5pt" pe="8mm">
              <Radio checked={Boolean(p?.termsAcceptedAt)} />
              <Text>
                {tx("I have read the terms and conditions and I accept them. I know the organisers check my registration before I can take part.")}
              </Text>
            </Flex>
            <Box w="55mm" ms="auto" me="8mm" mt="9mm" textAlign="center">
              <Flex borderBottom="2px dotted" borderColor={LINE} h="6mm" justify="center" fontWeight="semibold" color={NAVY}>
                {p?.termsAcceptedAt ? formatDayNumeric(p.termsAcceptedAt) : "  /  /  "}
              </Flex>
              <Text mt="1.5mm">{tx("Date")}</Text>
            </Box>
          </Box>
        </Grid>
      </Box>

      {/* Footer: how to reach the organisers */}
      <Grid
        position="absolute"
        insetX="0"
        bottom="0"
        h="20mm"
        px="10mm"
        bg={NAVY}
        color="white"
        templateColumns="0.9fr 1.1fr 1.35fr"
        alignItems="center"
        gap="4mm"
        fontSize="9pt"
        fontWeight="semibold"
        lineHeight="1.35"
      >
        <FooterItem icon={<Phone size={16} />}>
          +257 61 83 46 85
          <br />
          +257 79 04 25 29
        </FooterItem>
        <FooterItem icon={<Mail size={16} />}>
          Gmail:
          <br />
          associationunisbu@gmail.com
        </FooterItem>
        <FooterItem icon={<MapPin size={16} />}>
          7ème Avenue N° 46 Kanyosha-Gisyo
          <br />
          Bujumbura - Burundi
        </FooterItem>
      </Grid>
    </Box>
  );
}

function SectionTitle({ children, mt }: { children: ReactNode; mt: string }) {
  return (
    <Text mt={mt} mb="2.6mm" fontSize="13pt" fontWeight="bold" color="#14182B">
      {children}
    </Text>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return (
    <Box display="grid" gap="3.4mm" ps="1mm">
      {children}
    </Box>
  );
}

// "Label  :  [        ]": a box to write in by hand (the blank form).
function Row({ label, children, plain = false }: { label: string; children: ReactNode; plain?: boolean }) {
  return (
    <Grid templateColumns="47mm minmax(0, 1fr)" alignItems="center" columnGap="0">
      <Flex justify="space-between" pe="4mm">
        <Text>{label}</Text>
        <Text>:</Text>
      </Flex>
      {plain ? (
        children
      ) : (
        <Flex h="7.2mm" minW="0" px="3mm" align="center" borderWidth="1px" borderColor={LINE} fontWeight="semibold" color={NAVY} truncate>
          {children}
        </Flex>
      )}
    </Grid>
  );
}

// DD / MM / YYYY, one box per digit, to write in by hand.
function DateBoxes() {
  const group = (count: number) => (
    <Flex gap="1mm">
      {Array.from({ length: count }, (_, i) => (
        <Flex key={i} w="7mm" h="7.2mm" borderWidth="1px" borderColor={LINE} align="center" justify="center" fontWeight="semibold" color={NAVY}>
        </Flex>
      ))}
    </Flex>
  );
  return (
    <Flex align="center" gap="2mm" flexShrink={0}>
      {group(2)}
      <Text>/</Text>
      {group(2)}
      <Text>/</Text>
      {group(4)}
    </Flex>
  );
}

function Radio({ checked, children }: { checked: boolean; children?: ReactNode }) {
  return (
    <Flex align="center" gap="2mm" flexShrink={0}>
      <Flex w="5mm" h="5mm" mt={children ? "0" : "0.6mm"} rounded="full" borderWidth="1.5px" borderColor="#55596B" align="center" justify="center">
        {checked && <Box w="2.6mm" h="2.6mm" rounded="full" bg={NAVY} />}
      </Flex>
      {children && <Text>{children}</Text>}
    </Flex>
  );
}

// "2012-05-04" or "2026-11-04T10:00…" → "04/05/2012". A plain day is read as written (no time zone shift).
const formatDayNumeric = (iso: string) => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// One line of the form. Filled in: "Label : answer" as text, or nothing when there is no answer.
// Blank: the empty box to write in.
function Line({ label, value, filled }: { label: string; value: ReactNode; filled: boolean }) {
  if (!filled) return <Row label={label}>{null}</Row>;
  if (value === null || value === undefined || value === "") return null;
  return (
    <Grid templateColumns="47mm minmax(0, 1fr)" alignItems="baseline" py="0.8mm" borderBottomWidth="1px" borderColor="#E3E5EE">
      <Flex justify="space-between" pe="4mm" color="#4A4F66">
        <Text>{label}</Text>
        <Text>:</Text>
      </Flex>
      <Text ps="3mm" fontWeight="semibold" color={NAVY}>
        {value}
      </Text>
    </Grid>
  );
}

const Dots = () => (
  <Box as="span" display="inline-block" w="34mm" borderBottom="2px dotted" borderColor="#14182B" transform="translateY(-1mm)" />
);

function FooterItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Flex align="center" gap="3mm">
      <Flex w="8.5mm" h="8.5mm" rounded="full" bg="white" color={NAVY} align="center" justify="center" flexShrink={0}>
        {icon}
      </Flex>
      <Box>{children}</Box>
    </Flex>
  );
}
