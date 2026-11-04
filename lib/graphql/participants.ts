import { gql, type TypedDocumentNode } from "@apollo/client";

export type ParticipantStatus = "PENDING" | "PASSED" | "FAILED";
export type Gender = "MALE" | "FEMALE";
// The admin's check against the terms. Only APPROVED people compete; judges and staff see only them.
export type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

// What the list needs: enough to show, filter (province, commune, gender, age) and sort.
export interface ParticipantRow {
  id: string;
  fullName: string;
  phone: string;
  institution: string;
  commune: string;
  province: string;
  gender: Gender;
  dateOfBirth: string;
  photoUrl: string;
  score: number | null; // final: the judges' average, null until the panel is complete
  status: ParticipantStatus;
  sheetsSubmitted: number; // judges who submitted their sheet
  registeredAt: string;
  review: ReviewStatus;
}

export interface ParticipantDetail extends ParticipantRow {
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
  awaitingReview: number | null;
  rejected: number | null;
}

export interface Settings {
  passMark: number;
  maxScore: number;
  judgeCount: number; // judges who must submit before the average counts
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
    fullName
    phone
    institution
    commune
    province
    gender
    dateOfBirth
    photoUrl
    score
    status
    sheetsSubmitted
    registeredAt
    review
  }
`;

const DETAIL_FIELDS = gql`
  fragment ParticipantDetailFields on Participant {
    ...ParticipantRowFields
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
      awaitingReview
      rejected
    }
    settings {
      passMark
      maxScore
      judgeCount
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
      updatedAt
    }
  }
`;

export const UPDATE_SETTINGS: TypedDocumentNode<
  { updateSettings: Settings },
  { input: { passMark: number; maxScore: number; judgeCount: number } }
> = gql`
  mutation UpdateSettings($input: UpdateSettingsInput!) {
    updateSettings(input: $input) {
      passMark
      maxScore
      judgeCount
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
