import { gql, type TypedDocumentNode } from "@apollo/client";
import type { ParticipantDetail } from "./participants";

// The paper "ALAMA" sheet: numbers come from the server so screens and results always agree.
export interface ScoringRules {
  questions: number;
  questionPoints: number; // 33: the recitation plus its third of the sauti
  sautiMax: number; // 5, given once, a third inside each question
  presencePoints: number; // 1: 3 × 33 + 1 = 100
  fathLimit: number;
  fathPenalty: number;
  tanbihPenalty: number;
  tajweedPenalty: number;
  kusitaPenalty: number;
}

export interface Marks {
  fath: number; // ● reminded by the judge
  tanbih: number; // I judge tapped the table
  tajweed: number; // X tajweed / waqf / ibtida mistake
  kusita: number; // S the participant hesitates
}

export interface QuestionMarks extends Marks {
  score: number;
  deleted: boolean;
}

export interface JudgeSheet {
  id: string;
  judge: { id: string; name: string } | null;
  questions: QuestionMarks[];
  sauti: number | null;
  total: number | null;
  submitted: boolean;
  submittedAt: string | null;
  updatedAt: string;
}

export interface Envelope {
  id: string;
  number: number;
  questions: string[];
  used: boolean;
  usedBy: { id: string; fullName: string } | null;
  usedAt: string | null;
}

export interface StageParticipant extends ParticipantDetail {
  envelope: Envelope | null;
  mySheet: JudgeSheet | null;
}

const SHEET_FIELDS = gql`
  fragment JudgeSheetFields on JudgeSheet {
    id
    judge {
      id
      name
    }
    questions {
      fath
      tanbih
      tajweed
      kusita
      score
      deleted
    }
    sauti
    total
    submitted
    submittedAt
    updatedAt
  }
`;

const ENVELOPE_FIELDS = gql`
  fragment EnvelopeFields on Envelope {
    id
    number
    questions
    used
    usedBy {
      id
      fullName
    }
    usedAt
  }
`;

// Everything a judge's screen or the stage needs about one participant.
const JUDGING_PARTICIPANT_FIELDS = gql`
  fragment JudgingParticipantFields on Participant {
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
    sheetsSubmitted
    registeredAt
    guardianName
    guardianPhone
    idDocumentUrl
    scoredAt
    scoredBy {
      id
      name
    }
    envelope {
      ...EnvelopeFields
    }
    mySheet {
      ...JudgeSheetFields
    }
  }
  ${ENVELOPE_FIELDS}
  ${SHEET_FIELDS}
`;

export const SCORING_RULES: TypedDocumentNode<{ scoringRules: ScoringRules }> = gql`
  query ScoringRules {
    scoringRules {
      questions
      questionPoints
      sautiMax
      presencePoints
      fathLimit
      fathPenalty
      tanbihPenalty
      tajweedPenalty
      kusitaPenalty
    }
  }
`;

export const STAGE: TypedDocumentNode<{ stage: { participant: StageParticipant | null; updatedAt: string } }> = gql`
  query Stage {
    stage {
      participant {
        ...JudgingParticipantFields
      }
      updatedAt
    }
  }
  ${JUDGING_PARTICIPANT_FIELDS}
`;

export const JUDGING_PARTICIPANT: TypedDocumentNode<{ participant: StageParticipant | null }, { id: string }> = gql`
  query JudgingParticipant($id: ID!) {
    participant(id: $id) {
      ...JudgingParticipantFields
    }
  }
  ${JUDGING_PARTICIPANT_FIELDS}
`;

export const PARTICIPANT_SHEETS: TypedDocumentNode<
  { participant: { id: string; envelope: Envelope | null; sheetsSubmitted: number; sheets: JudgeSheet[] } | null },
  { id: string }
> = gql`
  query ParticipantSheets($id: ID!) {
    participant(id: $id) {
      id
      sheetsSubmitted
      envelope {
        ...EnvelopeFields
      }
      sheets {
        ...JudgeSheetFields
      }
    }
  }
  ${ENVELOPE_FIELDS}
  ${SHEET_FIELDS}
`;

export const SAVE_SHEET: TypedDocumentNode<
  { saveSheet: JudgeSheet },
  { input: { participantId: string; questions: Marks[]; sauti: number | null; submit: boolean } }
> = gql`
  mutation SaveSheet($input: SaveSheetInput!) {
    saveSheet(input: $input) {
      ...JudgeSheetFields
    }
  }
  ${SHEET_FIELDS}
`;

export const ENVELOPES: TypedDocumentNode<{ envelopes: Envelope[] }> = gql`
  query Envelopes {
    envelopes {
      ...EnvelopeFields
    }
  }
  ${ENVELOPE_FIELDS}
`;

export const ENVELOPE_SLOTS: TypedDocumentNode<{ envelopeSlots: { id: string }[] }> = gql`
  query EnvelopeSlots {
    envelopeSlots {
      id
    }
  }
`;

export const CREATE_ENVELOPE: TypedDocumentNode<{ createEnvelope: Envelope }, { questions: string[] }> = gql`
  mutation CreateEnvelope($questions: [String!]!) {
    createEnvelope(input: { questions: $questions }) {
      ...EnvelopeFields
    }
  }
  ${ENVELOPE_FIELDS}
`;

export const UPDATE_ENVELOPE: TypedDocumentNode<{ updateEnvelope: Envelope }, { id: string; questions: string[] }> = gql`
  mutation UpdateEnvelope($id: ID!, $questions: [String!]!) {
    updateEnvelope(id: $id, input: { questions: $questions }) {
      ...EnvelopeFields
    }
  }
  ${ENVELOPE_FIELDS}
`;

export const DELETE_ENVELOPE: TypedDocumentNode<{ deleteEnvelope: boolean }, { id: string }> = gql`
  mutation DeleteEnvelope($id: ID!) {
    deleteEnvelope(id: $id)
  }
`;

export const CALL_PARTICIPANT: TypedDocumentNode<{ callParticipant: { updatedAt: string } }, { participantId: string | null }> = gql`
  mutation CallParticipant($participantId: ID) {
    callParticipant(participantId: $participantId) {
      updatedAt
    }
  }
`;

export const DRAW_ENVELOPE: TypedDocumentNode<{ drawEnvelope: { updatedAt: string } }, { envelopeId: string }> = gql`
  mutation DrawEnvelope($envelopeId: ID!) {
    drawEnvelope(envelopeId: $envelopeId) {
      updatedAt
    }
  }
`;

// Same rules as the server (lib/sheet.ts there), for the live preview while marking.
// A question of 33 = 31.33 for the recitation (mistakes come off it, never below 0) + a third of
// the sauti (1.67 at most). The 3rd Fath deletes it: 0, its share of the sauti included.
function questionPoints(q: Marks, sauti: number | null, r: ScoringRules) {
  if (q.fath >= r.fathLimit) return 0;
  const recitation = r.questionPoints - r.sautiMax / r.questions;
  const lost =
    q.fath * r.fathPenalty + q.tanbih * r.tanbihPenalty + q.tajweed * r.tajweedPenalty + (q.kusita ?? 0) * r.kusitaPenalty;
  return Math.max(0, recitation - lost) + (sauti ?? 0) / r.questions;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// One question out of 33 (sauti not given yet counts as 0).
export const questionScore = (q: Marks, sauti: number | null, r: ScoringRules) => round2(questionPoints(q, sauti, r));

// One judge's total out of 100: the questions plus presence. Null until sauti is given.
export function sheetTotal(questions: Marks[], sauti: number | null, r: ScoringRules) {
  if (sauti === null) return null;
  return round2(questions.reduce((sum, q) => sum + questionPoints(q, sauti, r), 0) + r.presencePoints);
}

export interface QueueParticipant {
  id: string;
  fullName: string;
  institution: string;
  commune: string;
  province: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  photoUrl: string;
  registeredAt: string;
  score: number | null;
  status: "PENDING" | "PASSED" | "FAILED";
  finalist: boolean;
  sheetsSubmitted: number;
  envelope: { id: string; number: number } | null;
}

// The stage's list: who still has to recite (no envelope yet) and who already did.
export const STAGE_QUEUE: TypedDocumentNode<{ participants: QueueParticipant[] }> = gql`
  query StageQueue {
    # Only approved registrations compete (the admin would otherwise see the review queue too).
    participants(review: APPROVED) {
      id
      fullName
      institution
      commune
      province
      gender
      dateOfBirth
      photoUrl
      registeredAt
      score
      status
      finalist
      sheetsSubmitted
      envelope {
        id
        number
      }
    }
  }
`;

// The stage screen: the tablet on stage where the participant picks a closed envelope.
// No login, only a secret link the admin creates. It never receives a question.
export interface StageScreenLink {
  url: string;
  updatedAt: string;
}

export const STAGE_SCREEN_LINK: TypedDocumentNode<{ stageScreenLink: StageScreenLink | null }> = gql`
  query StageScreenLink {
    stageScreenLink {
      url
      updatedAt
    }
  }
`;

export const REGENERATE_STAGE_SCREEN_LINK: TypedDocumentNode<{ regenerateStageScreenLink: StageScreenLink }> = gql`
  mutation RegenerateStageScreenLink {
    regenerateStageScreenLink {
      url
      updatedAt
    }
  }
`;

export interface StageScreenView {
  valid: boolean;
  participant: { id: string; fullName: string } | null;
  drawn: boolean;
  envelopeNumber: number | null;
  slots: { id: string }[];
}

const STAGE_SCREEN_FIELDS = gql`
  fragment StageScreenFields on StageScreenView {
    valid
    participant {
      id
      fullName
    }
    drawn
    envelopeNumber
    slots {
      id
    }
  }
`;

export const STAGE_SCREEN: TypedDocumentNode<{ stageScreen: StageScreenView }, { token: string }> = gql`
  query StageScreen($token: String!) {
    stageScreen(token: $token) {
      ...StageScreenFields
    }
  }
  ${STAGE_SCREEN_FIELDS}
`;

export const STAGE_SCREEN_DRAW: TypedDocumentNode<{ stageScreenDraw: StageScreenView }, { token: string; envelopeId: string }> = gql`
  mutation StageScreenDraw($token: String!, $envelopeId: ID!) {
    stageScreenDraw(token: $token, envelopeId: $envelopeId) {
      ...StageScreenFields
    }
  }
  ${STAGE_SCREEN_FIELDS}
`;
