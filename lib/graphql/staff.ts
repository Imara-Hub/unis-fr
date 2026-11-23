import { gql, type TypedDocumentNode } from "@apollo/client";
import type { Role, User } from "./auth";
import type { AppKey } from "@/lib/i18n/core";

export type InvitableRole = "JUDGE" | "STAFF";
export type InvitationStatus = "PENDING" | "USED" | "EXPIRED" | "REVOKED";

export interface TeamMember extends User {
  isActive: boolean;
  createdAt: string;
  // Personal login link, as a path (/go/<code>): null for the admin and while deactivated.
  loginLink: string | null;
  // The password the admin created for them, readable by the admin until they choose their own.
  password: string | null;
}

export interface StaffInvitation {
  id: string;
  role: InvitableRole;
  note: string | null;
  status: InvitationStatus;
  expiresAt: string;
  usedBy: { id: string; name: string } | null;
  createdAt: string;
}

const INVITATION_FIELDS = gql`
  fragment StaffInvitationFields on StaffInvitation {
    id
    role
    note
    status
    expiresAt
    usedBy {
      id
      name
    }
    createdAt
  }
`;

export const TEAM: TypedDocumentNode<{ users: TeamMember[]; staffInvitations: StaffInvitation[] }> = gql`
  query Team {
    users {
      id
      name
      email
      role
      isActive
      avatarUrl
      createdAt
      loginLink
      password
    }
    staffInvitations {
      ...StaffInvitationFields
    }
  }
  ${INVITATION_FIELDS}
`;

export const CREATE_STAFF_INVITATION: TypedDocumentNode<
  { createStaffInvitation: { url: string; invitation: StaffInvitation } },
  { input: { role: InvitableRole; note?: string | null } }
> = gql`
  mutation CreateStaffInvitation($input: CreateStaffInvitationInput!) {
    createStaffInvitation(input: $input) {
      url
      invitation {
        ...StaffInvitationFields
      }
    }
  }
  ${INVITATION_FIELDS}
`;

export const REVOKE_STAFF_INVITATION: TypedDocumentNode<{ revokeStaffInvitation: StaffInvitation }, { id: string }> =
  gql`
    mutation RevokeStaffInvitation($id: ID!) {
      revokeStaffInvitation(id: $id) {
        ...StaffInvitationFields
      }
    }
    ${INVITATION_FIELDS}
  `;

export const SET_USER_ACTIVE: TypedDocumentNode<
  { setUserActive: { id: string; isActive: boolean; loginLink: string | null; password: string | null } },
  { input: { userId: string; active: boolean } }
> = gql`
  mutation SetUserActive($input: SetUserActiveInput!) {
    setUserActive(input: $input) {
      id
      isActive
      # Deactivated: no working login link; reactivated: it is back.
      loginLink
      password
    }
  }
`;

export const UPDATE_USER: TypedDocumentNode<
  { updateUser: { id: string; name: string; role: Role } },
  { input: { userId: string; name?: string | null; role?: InvitableRole | null } }
> = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      name
      role
    }
  }
`;

export const REMOVE_USER: TypedDocumentNode<{ removeUser: boolean }, { userId: string }> = gql`
  mutation RemoveUser($userId: ID!) {
    removeUser(userId: $userId)
  }
`;

// Admin only. Creates the account at once; the temporary password comes back once.
export const CREATE_TEAM_MEMBER: TypedDocumentNode<
  { createTeamMember: { user: { id: string; name: string; email: string | null; role: Role; loginLink: string | null }; temporaryPassword: string } },
  { input: { name: string; email: string; role: InvitableRole } }
> = gql`
  mutation CreateTeamMember($input: CreateTeamMemberInput!) {
    createTeamMember(input: $input) {
      user {
        id
        name
        email
        role
        loginLink
      }
      temporaryPassword
    }
  }
`;

// Admin only. The temporary password comes back once and is never stored in clear.
export const RESET_USER_PASSWORD: TypedDocumentNode<
  { resetUserPassword: { user: { id: string; name: string }; temporaryPassword: string } },
  { userId: string }
> = gql`
  mutation ResetUserPassword($userId: ID!) {
    resetUserPassword(userId: $userId) {
      user {
        id
        name
      }
      temporaryPassword
    }
  }
`;

export const INVITATION_CHECK: TypedDocumentNode<
  { invitationCheck: { valid: boolean; role: InvitableRole | null } },
  { token: string }
> = gql`
  query InvitationCheck($token: String!) {
    invitationCheck(token: $token) {
      valid
      role
    }
  }
`;

export const ACCEPT_STAFF_INVITATION: TypedDocumentNode<
  { acceptStaffInvitation: { user: User } },
  { input: { token: string; name: string; email: string; password: string } }
> = gql`
  mutation AcceptStaffInvitation($input: AcceptStaffInvitationInput!) {
    acceptStaffInvitation(input: $input) {
      user {
        id
        name
        email
        role
      }
    }
  }
`;

export const ACCEPT_STAFF_INVITATION_WITH_GOOGLE: TypedDocumentNode<
  { acceptStaffInvitationWithGoogle: { user: User } },
  { input: { token: string; idToken: string } }
> = gql`
  mutation AcceptStaffInvitationWithGoogle($input: AcceptStaffInvitationWithGoogleInput!) {
    acceptStaffInvitationWithGoogle(input: $input) {
      user {
        id
        name
        email
        role
      }
    }
  }
`;

// Admin only: the key of the entry link (/enter/<key>), null when there is no gate.
export const ORG_ACCESS_KEY: TypedDocumentNode<{ orgAccessKey: string | null }> = gql`
  query OrgAccessKey {
    orgAccessKey
  }
`;

// Admin only: a new key. Every device (this one included) must open a link again.
export const REGENERATE_ACCESS_KEY: TypedDocumentNode<{ regenerateAccessKey: string }> = gql`
  mutation RegenerateAccessKey {
    regenerateAccessKey
  }
`;

// English: shown through tx() (lib/i18n), so each language has its own words.
export const ROLE_LABELS: Record<Role, AppKey> = { ADMIN: "Admin", JUDGE: "Judge", STAFF: "Staff" };

// A new personal login link: the old one stops working and the person is logged out everywhere.
export const NEW_LOGIN_LINK: TypedDocumentNode<{ newLoginLink: { id: string; loginLink: string | null } }, { userId: string }> = gql`
  mutation NewLoginLink($userId: ID!) {
    newLoginLink(userId: $userId) {
      id
      loginLink
    }
  }
`;
