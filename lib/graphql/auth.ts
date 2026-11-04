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

export const ME: TypedDocumentNode<{ me: User | null }> = gql`
  query Me {
    me {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const SIGNUP_OPEN: TypedDocumentNode<{ signupOpen: boolean }> = gql`
  query SignupOpen {
    signupOpen
  }
`;

export const SIGNUP: TypedDocumentNode<{ signup: { user: User } }, { input: SignupInput }> = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      user {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`;

export const LOGIN: TypedDocumentNode<{ login: { user: User } }, { email: string; password: string }> = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        ...UserFields
      }
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
