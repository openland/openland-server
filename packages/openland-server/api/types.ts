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