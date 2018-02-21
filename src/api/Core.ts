export const Schema = `
  
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    itemsCount: Int!
    pagesCount: Int!
    currentPage: Int!
    openEnded: Boolean!
  }
  
  type Likes {
    liked: Boolean!
    count: Int
  }

  type Geo {
    latitude: Float!
    longitude: Float!
  }

  input GeoInput {
    latitude: Float!
    longitude: Float!
  }

  input GeoInputShort {
    la: Float!
    lo: Float!
  }

  input GeoEnvelope {
    leftTop: GeoInput!
    rightBottom: GeoInput!
  }

  type Chart {
    labels: [String!]!
    datasets: [ChartDataSet!]!
  }
  
  type ChartDataSet {
    label: String!
    values: [Float!]!
  }

  type Street {
    id: ID!
    name: String
    suffix: String
    fullName: String
  }

  type StreetNumber {
    streetId: ID!
    streetName: String!
    streetNameSuffix: String
    streetNumber: Int!
    streetNumberSuffix: String
  }

  input ExtraEnumInput {
    key: String!
    value: [String!]!
  }

  input ExtraStringInput {
    key: String!
    value: String!
  }

  input ExtraFloatInput {
    key: String!
    value: Float!
  }

  input ExtraIntInput {
    key: String!
    value: Int!
  }

  input GeoBox {
    east: Float!
    north: Float!
    west: Float!
    south: Float!
  }

  input ExtrasInput {
    enums: [ExtraEnumInput!]
    strings: [ExtraStringInput!]
    floats: [ExtraFloatInput!]
    ints: [ExtraIntInput!]
  }
`;

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