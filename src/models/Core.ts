export const Schema = `
  
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    itemsCount: Int!
    pagesCount: Int!
    currentPage: Int!
    openEnded: Boolean!
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
`;

export interface GeoInput {
  latitude: number;
  longitude: number;
}

export interface GeoEnvelope {
  leftTop: GeoInput;
  rightBottom: GeoInput;
}