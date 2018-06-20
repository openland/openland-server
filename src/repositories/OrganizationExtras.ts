import { ImageRef } from './Media';

export interface Range {
    from?: number;
    to?: number;
}

export interface ContactPerson {
    name: string;
    photoRef?: ImageRef | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    link?: string | null;
}
export interface FeaturedOpportunity {
    title: string;
    location: { lon: number, lat: number, ref?: string, count?: number };
    locationTitle: string;
    tags?: string[] | null;
}

export interface ListingExtras {
    // common
    summary?: string | null;
    specialAttributes?: string[] | null;
    status?: 'open' | null;
    photo?: ImageRef | null;

    // DO
    location?: { lon: number, lat: number, ref?: string, count?: number };
    locationTitle?: string;
    availability?: string | null;
    area?: number | null;
    price?: number | null;
    dealType?: string[] | null;
    shapeAndForm?: string[] | null;
    currentUse?: string[] | null;
    goodFitFor?: string[] | null;
    additionalLinks?: { text: string, url: string }[] | null;

    // AR
    shortDescription?: string | null;
    areaRange?: Range | null;
    geographies?: string[] | null;
    landUse?: string[] | null;
    unitCapacity?: string[] | null;
}

export interface OrganizationExtras {
    potentialSites?: Range[] | null;
    siteSizes?: Range[] | null;
    about?: String | null;
    twitter?: string | null;
    location?: string | null;
    facebook?: string | null;
    developmentModels?: string[] | null;
    availability?: string[] | null;
    contacts?: ContactPerson[] | null;
    landUse?: string[] | null;
    goodFor?: string[] | null;
    specialAttributes?: string[] | null;
    featuredOpportunities?: FeaturedOpportunity[] | null;
    organizationType?: string[] | null;
    lookingFor?: string[] | null;
    geographies?: string[] | null;
    doShapeAndForm?: string[] | null;
    doCurrentUse?: string[] | null;
    doGoodFitFor?: string[] | null;
    doSpecialAttributes?: string[] | null;
    doAvailability?: string[] | null;
    arGeographies?: string[] | null;
    arAreaRange?: string[] | null;
    arHeightLimit?: string[] | null;
    arActivityStatus?: string[] | null;
    arAquisitionBudget?: string[] | null;
    arAquisitionRate?: string[] | null;
    arClosingTime?: string[] | null;
    arSpecialAttributes?: string[] | null;
    arLandUse?: string[] | null;
}
