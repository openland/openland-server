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

  type Chart {
    labels: [String!]!
    datasets: [ChartDataSet!]!
  }
  
  type ChartDataSet {
    label: String!
    values: [Float!]!
  }
`;