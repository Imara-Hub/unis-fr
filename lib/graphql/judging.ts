import type { MarkDifference } from "@/lib/errors";
import { gql, type TypedDocumentNode } from "@apollo/client";
import type { Round } from "@/lib/quran";
import type { ParticipantDetail } from "./participants";

export type { Round };

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
  presence: boolean | null; // the judge's choice when 2+ questions are deleted; null when given by itself
  total: number | null;
  submitted: boolean;
  submittedAt: string | null;
  updatedAt: string;
  // Admin and staff: where this submitted sheet's Fath, Tanbih or Kusita differs from the others.
  differs?: MarkDifference[];
}

export interface Envelope {
  id: string;
  number: number;
  round: Round; // TASFIA: one page a question; FINAL: half a page
  questions: string[]; // "surah:ayah-surah:ayah" (an older one: "surah:ayah", one page)
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
    presence
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
    round
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
    inFinal
    finalScore
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
      # Where the judge's Fath, Tanbih or Kusita count differs from the judges who finished the same
      # questions: updates live, also after this judge already moved on.
      differs {
        question
        mark
        count
      }
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

// The participant's envelope, sheets and sheet count are those of the round on stage (`round`):
// the tasfia, then the final once the admin starts it.
export const STAGE: TypedDocumentNode<{
  stage: { participant: StageParticipant | null; updatedAt: string; round: Round; finished: boolean };
}> = gql`
  query Stage {
    stage {
      participant {
        ...JudgingParticipantFields
      }
      updatedAt
      round
      finished
    }
  }
  ${JUDGING_PARTICIPANT_FIELDS}
`;

// Admin only. The tasfia is over: the finalists are fixed and the stage moves to the final.
export const START_FINAL: TypedDocumentNode<{ startFinal: { round: Round } }, Record<string, never>> = gql`
  mutation StartFinal {
    startFinal {
      round
      updatedAt
    }
  }
`;

// Admin only. Back to the tasfia, before any finalist drew a final envelope.
export const CANCEL_FINAL: TypedDocumentNode<{ cancelFinal: { round: Round } }, Record<string, never>> = gql`
  mutation CancelFinal {
    cancelFinal {
      round
      updatedAt
    }
  }
`;

export const JUDGING_PARTICIPANT: TypedDocumentNode<{ participant: StageParticipant | null }, { id: string }> = gql`
  query JudgingParticipant($id: ID!) {
    participant(id: $id) {
      ...JudgingParticipantFields
    }
  }
  ${JUDGING_PARTICIPANT_FIELDS}
`;

// One round's envelope and sheets; no round: the round on stage now.
export const PARTICIPANT_SHEETS: TypedDocumentNode<
  { participant: { id: string; envelope: Envelope | null; sheetsSubmitted: number; sheets: JudgeSheet[] } | null },
  { id: string; round?: Round }
> = gql`
  query ParticipantSheets($id: ID!, $round: EnvelopeRound) {
    participant(id: $id) {
      id
      sheetsSubmitted(round: $round)
      envelope(round: $round) {
        ...EnvelopeFields
      }
      sheets(round: $round) {
        ...JudgeSheetFields
        # Where a count everyone hears differs from the judges who finished the same questions.
        differs {
          question
          mark
          count
        }
      }
    }
  }
  ${ENVELOPE_FIELDS}
  ${SHEET_FIELDS}
`;

// Judges: "Done" on a question. Saves the draft; refused with MARKS_DIFFER while a Fath, Tanbih or
// Kusita count up to that question differs from the judges who finished it too.
export const FINISH_QUESTION: TypedDocumentNode<
  { finishQuestion: { id: string } },
  { input: { participantId: string; questions: Marks[]; sauti: number | null; question: number; round?: Round } }
> = gql`
  mutation FinishQuestion($input: FinishQuestionInput!) {
    finishQuestion(input: $input) {
      id
    }
  }
`;

// Admin only: a submitted sheet goes back to its judge as a draft (to correct a miscount).
export const REOPEN_SHEET: TypedDocumentNode<{ reopenSheet: { id: string; submitted: boolean } }, { id: string }> = gql`
  mutation ReopenSheet($id: ID!) {
    reopenSheet(sheetId: $id) {
      id
      submitted
    }
  }
`;

// When the judge's own sheet last changed on the server: a copy waiting on the tablet older than
// that is not sent (see lib/sheetOutbox).
export const MY_SHEET_VERSION: TypedDocumentNode<
  { participant: { id: string; mySheet: { id: string; updatedAt: string } | null } | null },
  { id: string; round: Round }
> = gql`
  query MySheetVersion($id: ID!, $round: EnvelopeRound) {
    participant(id: $id) {
      id
      mySheet(round: $round) {
        id
        updatedAt
      }
    }
  }
`;

export const SAVE_SHEET: TypedDocumentNode<
  { saveSheet: JudgeSheet },
  { input: { participantId: string; questions: Marks[]; sauti: number | null; presence: boolean | null; submit: boolean; round?: Round } }
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

export const CREATE_ENVELOPE: TypedDocumentNode<{ createEnvelope: Envelope }, { questions: string[]; round: Round }> = gql`
  mutation CreateEnvelope($questions: [String!]!, $round: EnvelopeRound) {
    createEnvelope(input: { questions: $questions, round: $round }) {
      ...EnvelopeFields
    }
  }
  ${ENVELOPE_FIELDS}
`;

export const CREATE_RANDOM_ENVELOPES: TypedDocumentNode<{ createRandomEnvelopes: Envelope[] }, { count: number; round: Round }> = gql`
  mutation CreateRandomEnvelopes($count: Int!, $round: EnvelopeRound) {
    createRandomEnvelopes(count: $count, round: $round) {
      ...EnvelopeFields
    }
  }
  ${ENVELOPE_FIELDS}
`;

export const UPDATE_ENVELOPE: TypedDocumentNode<{ updateEnvelope: Envelope }, { id: string; questions: string[]; round: Round }> = gql`
  mutation UpdateEnvelope($id: ID!, $questions: [String!]!, $round: EnvelopeRound) {
    updateEnvelope(id: $id, input: { questions: $questions, round: $round }) {
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

// Every envelope not drawn yet; returns how many were deleted (drawn ones stay).
export const DELETE_UNUSED_ENVELOPES: TypedDocumentNode<{ deleteUnusedEnvelopes: number }, Record<string, never>> = gql`
  mutation DeleteUnusedEnvelopes {
    deleteUnusedEnvelopes
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

// One judge's total out of 100: the questions plus the presence point, always given by itself.
// Null until sauti is given.
export function sheetTotal(questions: Marks[], sauti: number | null, r: ScoringRules) {
  if (sauti === null) return null;
  return round2(questions.reduce((sum, q) => sum + questionPoints(q, sauti, r), 0) + r.presencePoints);
}

export interface QueueParticipant {
  id: string;
  number: number | null; // N°: the order of passage given by the admin
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
  inFinal: boolean; // fixed when the admin started the final
  finalScore: number | null;
  // These three are about the round on stage (the tasfia, then the final).
  sheetsSubmitted: number;
  envelope: { id: string; number: number } | null;
  // Judges: their own sheet (null for the others, or before they marked anything).
  mySheet: { id: string; submitted: boolean } | null;
}

// The order of passage: by the number the admin gave (N° 1 first); those without a number come
// after, in the order they registered.
export function byPassageOrder<T extends { number: number | null; registeredAt: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.number !== null && b.number !== null) return a.number - b.number;
    if (a.number !== null) return -1;
    if (b.number !== null) return 1;
    return a.registeredAt.localeCompare(b.registeredAt);
  });
}

// The stage's list: who still has to recite (no envelope yet) and who already did.
export const STAGE_QUEUE: TypedDocumentNode<{ participants: QueueParticipant[] }> = gql`
  query StageQueue {
    # Only approved registrations compete (the admin would otherwise see the review queue too).
    participants(review: APPROVED) {
      id
      number
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
      inFinal
      finalScore
      sheetsSubmitted
      envelope {
        id
        number
      }
      # Judges: whether their own sheet is in (a refused or reopened one waits to be corrected).
      mySheet {
        id
        submitted
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
  round: Round;
  participant: { id: string; fullName: string } | null;
  drawn: boolean; // which envelope is never sent to the tablet: the participant must not know it
  slots: { id: string }[];
  finished: boolean; // everyone has recited, every sheet is in
}

const STAGE_SCREEN_FIELDS = gql`
  fragment StageScreenFields on StageScreenView {
    valid
    round
    participant {
      id
      fullName
    }
    drawn
    slots {
      id
    }
    finished
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
