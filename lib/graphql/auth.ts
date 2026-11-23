import { gql, type TypedDocumentNode } from "@apollo/client";

export type Role = "ADMIN" | "JUDGE" | "STAFF";

export interface User {
  id: string;
  name: string;
  // Only the admin and the person themselves get it; others see null.
  email: string | null;
  role: Role;
  avatarUrl: string | null;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    email
    role
    avatarUrl
  }
`;

// photoTicket: this tab's ticket for picture addresses (see lib/sessionToken.ts).
export const ME: TypedDocumentNode<{ me: User | null; photoTicket: string | null }> = gql`
  query Me {
    me {
      ...UserFields
    }
    photoTicket
  }
  ${USER_FIELDS}
`;

export const SIGNUP_OPEN: TypedDocumentNode<{ signupOpen: boolean }> = gql`
  query SignupOpen {
    signupOpen
  }
`;

export interface AuthPayload {
  user: User;
  // Development only (per-tab logins); null in production, where the cookie holds the login.
  token: string | null;
}

export const SIGNUP: TypedDocumentNode<{ signup: AuthPayload }, { input: SignupInput }> = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      user {
        ...UserFields
      }
      token
    }
  }
  ${USER_FIELDS}
`;

export const LOGIN: TypedDocumentNode<{ login: AuthPayload }, { email: string; password: string }> = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        ...UserFields
      }
      token
    }
  }
  ${USER_FIELDS}
`;

// Sign in with Google: the ID token Google's button hands us.
export const LOGIN_WITH_GOOGLE: TypedDocumentNode<{ loginWithGoogle: AuthPayload }, { idToken: string }> = gql`
  mutation LoginWithGoogle($idToken: String!) {
    loginWithGoogle(idToken: $idToken) {
      user {
        ...UserFields
      }
      token
    }
  }
  ${USER_FIELDS}
`;

// Personal login link (/go/<code>): logs in with no password.
export const LOGIN_WITH_LINK: TypedDocumentNode<{ loginWithLink: AuthPayload }, { code: string }> = gql`
  mutation LoginWithLink($code: String!) {
    loginWithLink(code: $code) {
      user {
        ...UserFields
      }
      token
    }
  }
  ${USER_FIELDS}
`;

export const SIGNUP_WITH_GOOGLE: TypedDocumentNode<{ signupWithGoogle: AuthPayload }, { idToken: string }> = gql`
  mutation SignupWithGoogle($idToken: String!) {
    signupWithGoogle(idToken: $idToken) {
      user {
        ...UserFields
      }
      token
    }
  }
  ${USER_FIELDS}
`;

export const LOGOUT: TypedDocumentNode<{ logout: boolean }> = gql`
  mutation Logout {
    logout
  }
`;

export const UPDATE_PROFILE: TypedDocumentNode<{ updateProfile: User }, { input: { name: string } }> = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const CHANGE_PASSWORD: TypedDocumentNode<
  { changePassword: boolean },
  { input: { currentPassword: string; newPassword: string } }
> = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`;

export const REMOVE_AVATAR: TypedDocumentNode<{ removeAvatar: User }> = gql`
  mutation RemoveAvatar {
    removeAvatar {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

// Sent as a multipart request (see lib/account.ts), so a plain string.
export const SET_AVATAR = /* GraphQL */ `
  mutation SetAvatar($photo: File!) {
    setAvatar(photo: $photo) {
      id
      avatarUrl
    }
  }
`;
