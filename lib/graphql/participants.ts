import { gql, type TypedDocumentNode } from "@apollo/client";

export type ParticipantStatus = "PENDING" | "PASSED" | "FAILED";
export type Gender = "MALE" | "FEMALE";
// The admin's check against the terms. Only APPROVED people compete; judges and staff see only them.
export type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
// Who filled in the registration form. One phone may register many participants.
export type RegisteredBy = "SELF" | "GUARDIAN" | "INSTITUTION";
export const GUARDIAN_RELATIONS = ["FATHER", "MOTHER", "BROTHER", "SISTER", "UNCLE", "AUNT", "GRANDPARENT", "OTHER"] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];
export const REGISTRAR_INSTITUTION_TYPES = ["SCHOOL", "MASJID", "MARKAZ"] as const;
export type RegistrarInstitutionType = (typeof REGISTRAR_INSTITUTION_TYPES)[number];

// The parent / guardian, or the person responsible at the school / masjid / markaz.
export interface RegistrarContact {
  name: string;
  phone: string;
  relation: GuardianRelation | null; // GUARDIAN only
  institutionType: RegistrarInstitutionType | null; // INSTITUTION only
  institutionName: string | null;
}

// What the list needs: enough to show, filter (province, commune, gender, age) and sort.
export interface ParticipantRow {
  id: string;
  number: number | null; // N° 1, 2, 3… in the order they registered
  fullName: string;
  phone: string | null; // their own; null when a guardian or institution registered them without one
  registeredBy: RegisteredBy;
  contact: RegistrarContact | null; // null when they registered themselves
  institution: string;
  commune: string;
  province: string;
  gender: Gender;
  dateOfBirth: string;
  photoUrl: string;
  score: number | null; // final: the judges' average, null until the panel is complete
  status: ParticipantStatus;
  finalist: boolean; // among the best who passed: goes to the final
  sheetsSubmitted: number; // judges who submitted their sheet
  registeredAt: string;
  review: ReviewStatus;
}

export interface ParticipantDetail extends ParticipantRow {
  institutionLocation: string | null; // where the madrassa / halaqah / markaz is; null for people registered before
  guardianName: string | null; // only for people registered before it was dropped
  guardianPhone: string | null;
  idDocumentUrl: string | null; // null for people registered before it was asked
  scoredBy: { name: string } | null;
  scoredAt: string | null;
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  rejectionReason: string | null; // admin only
  termsVersion: number | null;
  termsAcceptedAt: string | null;
}

// Approved participants only, except the two review counts (admin only, null for others).
export interface Counts {
  total: number;
  pending: number;
  passed: number;
  failed: number;
  finalists: number; // going to the final
  awaitingReview: number | null;
  rejected: number | null;
}

export interface Settings {
  passMark: number;
  maxScore: number;
  judgeCount: number; // judges who must submit before the average counts
  finalistCount: number; // the best this many of those who passed go to the final
  // Only in the SETTINGS query: is the public results page showing the results?
  resultsPublished?: boolean;
  resultsPublishedAt?: string | null;
  updatedAt: string;
}

export interface ScoreChange {
  id: string;
  oldScore: number | null;
  newScore: number | null;
  changedBy: { name: string } | null;
  createdAt: string;
}

const ROW_FIELDS = gql`
  fragment ParticipantRowFields on Participant {
    id
    number
    fullName
    phone
    registeredBy
    contact {
      name
      phone
      relation
      institutionType
      institutionName
    }
    institution
    commune
    province
    gender
    dateOfBirth
    photoUrl
    score
    status
    finalist
    sheetsSubmitted
    registeredAt
    review
  }
`;

const DETAIL_FIELDS = gql`
  fragment ParticipantDetailFields on Participant {
    ...ParticipantRowFields
    institutionLocation
    guardianName
    guardianPhone
    idDocumentUrl
    scoredBy {
      id
      name
    }
    scoredAt
    reviewedBy {
      id
      name
    }
    reviewedAt
    rejectionReason
    termsVersion
    termsAcceptedAt
  }
  ${ROW_FIELDS}
`;

export const PARTICIPANTS: TypedDocumentNode<
  { participants: ParticipantRow[] },
  { status?: ParticipantStatus | null; search?: string | null; review?: ReviewStatus | null }
> = gql`
  query Participants($status: ParticipantStatus, $search: String, $review: ReviewStatus) {
    participants(status: $status, search: $search, review: $review) {
      ...ParticipantRowFields
    }
  }
  ${ROW_FIELDS}
`;

export const PARTICIPANT_COUNTS: TypedDocumentNode<{ participantCounts: Counts; settings: Settings }> = gql`
  query ParticipantCounts {
    participantCounts {
      total
      pending
      passed
      failed
      finalists
      awaitingReview
      rejected
    }
    settings {
      passMark
      maxScore
      judgeCount
      finalistCount
      updatedAt
    }
  }
`;

export const PARTICIPANT: TypedDocumentNode<
  { participant: ParticipantDetail | null; settings: Settings },
  { id: string }
> = gql`
  query Participant($id: ID!) {
    participant(id: $id) {
      ...ParticipantDetailFields
    }
    settings {
      passMark
      maxScore
      judgeCount
      finalistCount
      updatedAt
    }
  }
  ${DETAIL_FIELDS}
`;

export const SCORE_HISTORY: TypedDocumentNode<{ scoreHistory: ScoreChange[] }, { participantId: string }> = gql`
  query ScoreHistory($participantId: ID!) {
    scoreHistory(participantId: $participantId) {
      id
      oldScore
      newScore
      changedBy {
        id
        name
      }
      createdAt
    }
  }
`;

export const APPROVE_PARTICIPANT: TypedDocumentNode<{ approveParticipant: ParticipantDetail }, { id: string }> = gql`
  mutation ApproveParticipant($id: ID!) {
    approveParticipant(id: $id) {
      ...ParticipantDetailFields
    }
  }
  ${DETAIL_FIELDS}
`;

export const REJECT_PARTICIPANT: TypedDocumentNode<
  { rejectParticipant: ParticipantDetail },
  { id: string; reason: string }
> = gql`
  mutation RejectParticipant($id: ID!, $reason: String!) {
    rejectParticipant(id: $id, reason: $reason) {
      ...ParticipantDetailFields
    }
  }
  ${DETAIL_FIELDS}
`;

export const DELETE_PARTICIPANT: TypedDocumentNode<{ deleteParticipant: boolean }, { id: string }> = gql`
  mutation DeleteParticipant($id: ID!) {
    deleteParticipant(id: $id)
  }
`;

export const SETTINGS: TypedDocumentNode<{ settings: Settings }> = gql`
  query Settings {
    settings {
      passMark
      maxScore
      judgeCount
      finalistCount
      resultsPublished
      resultsPublishedAt
      updatedAt
    }
  }
`;

export const UPDATE_SETTINGS: TypedDocumentNode<
  { updateSettings: Settings },
  { input: { passMark: number; maxScore: number; judgeCount: number; finalistCount: number } }
> = gql`
  mutation UpdateSettings($input: UpdateSettingsInput!) {
    updateSettings(input: $input) {
      passMark
      maxScore
      judgeCount
      finalistCount
      updatedAt
    }
  }
`;

export const REGISTRATION_LINK_STATUS: TypedDocumentNode<
  {
    registrationLinkStatus: {
      valid: boolean;
      open: boolean;
      // Null until the admin writes terms: the form cannot be sent then.
      terms: { text: string; version: number } | null;
    };
  },
  { token: string }
> = gql`
  query RegistrationLinkStatus($token: String!) {
    registrationLinkStatus(token: $token) {
      valid
      open
      terms {
        text
        version
      }
    }
  }
`;

// Sent with fetch (multipart upload), not Apollo: Apollo cannot upload files by itself.
export const REGISTER_PARTICIPANT = /* GraphQL */ `
  mutation RegisterParticipant(
    $token: String!
    $input: RegisterParticipantInput!
    $photo: File!
    $idDocument: File!
  ) {
    registerParticipant(token: $token, input: $input, photo: $photo, idDocument: $idDocument) {
      fullName
    }
  }
`;

export const SET_RESULTS_PUBLISHED: TypedDocumentNode<
  { setResultsPublished: { resultsPublished: boolean; resultsPublishedAt: string | null } },
  { published: boolean }
> = gql`
  mutation SetResultsPublished($published: Boolean!) {
    setResultsPublished(published: $published) {
      passMark
      maxScore
      judgeCount
      finalistCount
      resultsPublished
      resultsPublishedAt
      updatedAt
    }
  }
`;

// The public results page: participants (or their parent / school) look up a result by name.
export interface PublicResult {
  fullName: string;
  institution: string;
  status: ParticipantStatus;
  score: number | null;
  finalist: boolean;
}

export const RESULT_LOOKUP: TypedDocumentNode<
  { resultLookup: { published: boolean; matches: PublicResult[] } },
  { name: string }
> = gql`
  query ResultLookup($name: String!) {
    resultLookup(name: $name) {
      published
      matches {
        fullName
        institution
        status
        score
        finalist
      }
    }
  }
`;
