import { PermitStatus, PermitType } from '../tables/Permit';

export type OpportunitySort = 'DATE_ADDED_ASC' | 'DATE_ADDED_DESC' | 'AREA_ASC' | 'AREA_DESC' | 'CAPACITY_ASC' | 'CAPACITY_DESC';

export interface GeoInput {
    latitude: number;
    longitude: number;
  }
  
  export interface GeoInputShort {
    la: number;
    lo: number;
  }
  
  export interface GeoEnvelope {
    leftTop: GeoInput;
    rightBottom: GeoInput;
  }
  
  export interface ExtrasInput {
    enums?: [{ key: string, value: string[] }] | null;
    strings?: [{ key: string, value: string }] | null;
    floats?: [{ key: string, value: number }] | null;
    ints?: [{ key: string, value: number }] | null;
  }

export interface PermitInfo {
    id: string;
    status?: PermitStatus;
    type?: PermitType;
    typeWood?: boolean;

    statusUpdatedAt?: string;
    createdAt?: string;
    issuedAt?: string;
    filedAt?: string;
    startedAt?: string;
    completedAt?: string;
    expiredAt?: string;
    expiresAt?: string;

    street?: [StreetNumberInfo];

    existingStories?: number;
    proposedStories?: number;
    existingUnits?: number;
    proposedUnits?: number;
    existingAffordableUnits?: number;
    proposedAffordableUnits?: number;
    proposedUse?: string;
    description?: string;

    parcelId?: string;
}

export interface StreetNumberInfo {
    streetName: string;
    streetNameSuffix?: string | null;
    streetNumber: number;
    streetNumberSuffix?: string | null;
}

export interface ParcelInput {
    id: string;
    blockId?: string | null;
    geometry?: number[][][][] | null;
    extras?: ExtrasInput | null;
    addresses?: {
        streetName: string,
        streetNameSuffix?: string | null
        streetNumber: number,
        streetNumberSuffix?: string | null
    }[];
    retired?: boolean;
}

export interface BlockInput {
    id: string;
    geometry?: number[][][][] | null;
    extras?: ExtrasInput | null;
}

export interface DealInput {
    title?: string | null;
    status?: 'ACTIVE' | 'CLOSED' | 'ON_HOLD' | null;
    statusDescription?: string | null;
    statusDate?: string | null;

    location?: string | null;
    address?: string | null;

    price?: number | null;

    extrasArea?: number | null;
    extrasCompany?: string | null;
    extrasAttorney?: string | null;
    extrasReferee?: string | null;

    extrasLotShape: string | null;
    extrasLotSize: string | null;
    extrasTaxBill: number | null;

    parcelId: string | null;
}