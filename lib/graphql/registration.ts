import { gql, type TypedDocumentNode } from "@apollo/client";

export interface RegistrationLink {
  token: string;
  url: string;
  isOpen: boolean;
  updatedAt: string;
}

// The terms and conditions the admin writes; registrants must accept them.
export interface RegistrationTerms {
  text: string;
  version: number; // goes up each time the text changes
  updatedAt: string | null;
}

const TERMS_FIELDS = gql`
  fragment RegistrationTermsFields on RegistrationTerms {
    text
    version
    updatedAt
  }
`;

// Null until the admin writes terms (registration stays closed until then).
export const REGISTRATION_TERMS: TypedDocumentNode<{ registrationTerms: RegistrationTerms | null }> = gql`
  query RegistrationTerms {
    registrationTerms {
      ...RegistrationTermsFields
    }
  }
  ${TERMS_FIELDS}
`;

export const UPDATE_REGISTRATION_TERMS: TypedDocumentNode<
  { updateRegistrationTerms: RegistrationTerms },
  { text: string }
> = gql`
  mutation UpdateRegistrationTerms($text: String!) {
    updateRegistrationTerms(text: $text) {
      ...RegistrationTermsFields
    }
  }
  ${TERMS_FIELDS}
`;

const LINK_FIELDS = gql`
  fragment RegistrationLinkFields on RegistrationLink {
    token
    url
    isOpen
    updatedAt
  }
`;

export const REGISTRATION_LINK: TypedDocumentNode<{ registrationLink: RegistrationLink | null }> = gql`
  query RegistrationLink {
    registrationLink {
      ...RegistrationLinkFields
    }
  }
  ${LINK_FIELDS}
`;

export const REGENERATE_REGISTRATION_LINK: TypedDocumentNode<{ regenerateRegistrationLink: RegistrationLink }> = gql`
  mutation RegenerateRegistrationLink {
    regenerateRegistrationLink {
      ...RegistrationLinkFields
    }
  }
  ${LINK_FIELDS}
`;

export const SET_REGISTRATION_OPEN: TypedDocumentNode<
  { setRegistrationOpen: RegistrationLink },
  { open: boolean }
> = gql`
  mutation SetRegistrationOpen($open: Boolean!) {
    setRegistrationOpen(open: $open) {
      ...RegistrationLinkFields
    }
  }
  ${LINK_FIELDS}
`;
