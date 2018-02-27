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