import { gql, type TypedDocumentNode } from "@apollo/client";

// Competition years: each keeps its participants, envelopes, sheets and results for good.
export interface Season {
  year: number;
  name: string | null;
  current: boolean; // the year being run now; the others are closed and read-only
  startedAt: string;
  closedAt: string | null;
  participantCount: number; // approved participants that year
  judgedCount: number; // of them, those with a final score
  edition: number | null;
  hijriYear: number | null;
  gregorianYear: number | null;
  bannerUrl: string | null; // API path of the year's banner (printed forms)
}

// How a year presents itself: the edition line on the public pages, the banner of the forms.
export interface Branding {
  year: number;
  edition: number | null;
  hijriYear: number | null;
  gregorianYear: number | null;
  bannerUrl: string | null;
}

const SEASON_FIELDS = gql`
  fragment SeasonFields on Season {
    year
    name
    current
    startedAt
    closedAt
    participantCount
    judgedCount
    edition
    hijriYear
    gregorianYear
    bannerUrl
  }
`;

const BRANDING_FIELDS = gql`
  fragment BrandingFields on Branding {
    year
    edition
    hijriYear
    gregorianYear
    bannerUrl
  }
`;

// Public: the current year's look (admin and staff looking back: that year's).
export const BRANDING: TypedDocumentNode<{ branding: Branding }> = gql`
  query Branding {
    branding {
      ...BrandingFields
    }
  }
  ${BRANDING_FIELDS}
`;

// Admin only: the current year's edition, Hijri and Gregorian years (null clears one).
export const UPDATE_BRANDING: TypedDocumentNode<
  { updateBranding: Branding },
  { input: { edition: number | null; hijriYear: number | null; gregorianYear: number | null } }
> = gql`
  mutation UpdateBranding($input: BrandingInput!) {
    updateBranding(input: $input) {
      ...BrandingFields
    }
  }
  ${BRANDING_FIELDS}
`;

export const REMOVE_BANNER: TypedDocumentNode<{ removeBanner: Branding }> = gql`
  mutation RemoveBanner {
    removeBanner {
      ...BrandingFields
    }
  }
  ${BRANDING_FIELDS}
`;

// Sent as a multipart upload (lib/account.ts uploadBanner), like the profile picture.
export const SET_BANNER = /* GraphQL */ `
  mutation SetBanner($image: File!) {
    setBanner(image: $image) {
      year
      bannerUrl
    }
  }
`;

// Admin and staff: every year, newest first.
export const SEASONS: TypedDocumentNode<{ seasons: Season[] }> = gql`
  query Seasons {
    seasons {
      ...SeasonFields
    }
  }
  ${SEASON_FIELDS}
`;

// Admin only: closes the current year and starts the next one.
export const START_SEASON: TypedDocumentNode<{ startSeason: Season }, { input: { year: number; name?: string | null } }> = gql`
  mutation StartSeason($input: StartSeasonInput!) {
    startSeason(input: $input) {
      ...SeasonFields
    }
  }
  ${SEASON_FIELDS}
`;
