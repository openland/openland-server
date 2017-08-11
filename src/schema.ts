import { makeExecutableSchema } from 'graphql-tools';
import * as Voting from './models/Voting'
import * as City from './models/City'
import * as Me from './models/Me';
import * as Project from './models/Project'
import * as DataSet from './models/Dataset'
import { merge } from 'lodash';
import { Context } from './models/Context';

const RootQuery = `
  type Query {
    healthCheck: String!
  }
`;

const RootMutation = `
  type Mutation {
    healthCheck: String!    
  }
`;

const SchemaDefinition = `
  schema {
    query: Query
    mutation: Mutation
  }
`;

const rootResolver = {
  Query: {
    healthCheck: async function (_obj: any, _params: {}, _context: Promise<Context>) {
      return "Hello World!"
    }
  },
  Mutation: {
    healthCheck: async function (_obj: any, _params: {}, _context: Promise<Context>) {
      return "Hello World!"
    }
  }
}

export const Schema = makeExecutableSchema({
  typeDefs: [
    RootQuery, RootMutation, SchemaDefinition,
    Voting.Schema,
    City.Schema,
    Me.Schema,
    Project.Schema,
    DataSet.Schema
  ],
  resolvers: merge(rootResolver,
    Voting.Resolver,
    City.Resolver,
    Me.Resolver,
    Project.Resolver,
    DataSet.Resolver
  )
})