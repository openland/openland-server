import { ImageRef } from './Media';

export type DevelopmentModels = 'request_for_proposals'
    | 'joint_venture'
    | 'ground_lease'
    | 'sale'
    | 'option_to_buy';

export const DevelopmentModelsValues = [
    'request_for_proposals',
    'joint_venture',
    'ground_lease',
    'sale',
    'option_to_buy'
];

export type Availability = 'immediate'
    | 'long_term'
    | 'near_future';

export const AvailabilityValues = [
    'immediate',
    'long_term',
    'near_future'
];

export type LandUse = 'residential'
    | 'commercial'
    | 'public'
    | 'mixed_use'
    | 'industrial';

export const LandUseValues = [
    'residential',
    'commercial',
    'public',
    'mixed_use',
    'industrial'
];

export type GoodFor = 'large_multi_family'
    | 'small_multi_family'
    | 'mixed_use'
    | 'office'
    | 'industrial'
    | 'non_traditional'
    | 'tower'
    | 'block_sized_development';

export const GoodForValues = [
    'large_multi_family',
    'small_multi_family',
    'mixed_use',
    'office',
    'industrial',
    'non_traditional',
    'tower',
    'block_sized_development'
];

export type SpecialAttributes = 'waterfront'
    | 'downtown'
    | 'parking'
    | 'fully_entitled'
    | 'recently_upzoned'
    | 'industrial'
    | 'mixed_use'
    | 'block_sized_development';

export const SpecialAttributesValues = [
    'waterfront',
    'downtown',
    'parking',
    'fully_entitled',
    'recently_upzoned',
    'industrial',
    'mixed_use',
    'block_sized_development'
];

export interface Range {
    from?: number;
    to?: number;
}

export interface ContactPerson {
    name: string;
    avatarRef?: ImageRef | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    link?: string | null;
}

export interface OrganizationExtras {
    potentialSites?: Range[] | null;
    siteSizes?: Range[] | null;
    about?: String | null;
    twitter?: string | null;
    location?: string | null;
    facebook?: string | null;
    developmentModels?: DevelopmentModels[] | null;
    availability?: Availability[] | null;
    contacts?: ContactPerson[] | null;
    landUse?: LandUse[] | null;
    goodFor?: GoodFor[] | null;
    specialAttributes?: SpecialAttributes[] | null;
}
