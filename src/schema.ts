import { makeExecutableSchema } from 'graphql-tools';
import * as Voting from './Models/Voting'
import { merge } from 'lodash';

// const Schemas = [Voting.Schema]
// const Queries = [Voting.Query]
// const Mutations = [Voting.Mutation]
// const Resolvers = [Voting.Resolver]

const RootQuery = `
  type Query {
    vote(id: Int!): Vote
  }
`;

const RootMutation = `
  type Mutation {
    vote(id: Int!): Vote
  }
`;

const SchemaDefinition = `
  schema {
    query: Query
    mutation: Mutation
  }
`;

export const Schema = makeExecutableSchema({
    typeDefs: [RootQuery, RootMutation, SchemaDefinition, Voting.Schema],
    resolvers: merge(Voting.Resolver)
})