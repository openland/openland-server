export interface Dashboard {
    id: string;
    title: string;
    description: string;
}
export const Schema = `
    type Dashboard {
        id: ID!
        title: String!
        description: String!
    }
    extend type Query {
        dashboard(id: ID!): Dashboard
    }
`

export const Resolver = {
    
}