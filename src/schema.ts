import { makeExecutableSchema } from 'graphql-tools';
import * as Voting from './models/Voting'
import * as Account from './models/Account'
import * as Me from './models/Me';
import * as Project from './models/Project'
import * as DataSet from './models/Dataset'
import * as Findings from './models/Findings'
import * as Permits from './models/Permit'
import { merge } from 'lodash';
import { Context } from './models/Context';

const RootQuery = `
  
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type Query {
    healthCheck: String!
  }
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
    RootQuery, SchemaDefinition,
    Voting.Schema,
    Account.Schema,
    Me.Schema,
    Project.Schema,
    DataSet.Schema,
    Findings.Schema,
    Permits.Schema
  ],
  resolvers: merge(rootResolver,
    Voting.Resolver,
    Account.Resolver,
    Me.Resolver,
    Project.Resolver,
    DataSet.Resolver,
    Findings.Resolver,
    Permits.Resolver
  )
})

export const AdminSchema = makeExecutableSchema({
  typeDefs: [
    RootQuery, SchemaDefinition,
    Account.AdminSchema,
  ],
  resolvers: merge(
    // rootResolver,
    Account.AdminResolver
  )
})