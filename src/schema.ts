import { makeExecutableSchema } from 'graphql-tools';
import * as Account from './models/Account'
import * as Me from './models/Me';
import * as Project from './models/Project'
import * as DataSet from './models/Dataset'
import * as Findings from './models/Findings'
import * as Permits from './models/Permit'
import * as Street from './models/Street'
import * as BuildingProject from './models/BuildingProject'
import * as Picture from './models/Picture';
import * as Developers from './models/Developers';
import { merge } from 'lodash';

const RootQuery = `
  
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    itemsCount: Int!
    pagesCount: Int!
    currentPage: Int!
  }

  type Geo {
    latitude: Float!
    longitude: Float!
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
    healthCheck: async function () {
      return "Hello World!"
    }
  },
  Mutation: {
    healthCheck: async function () {
      return "Hello World!"
    }
  }
}

export const Schema = makeExecutableSchema({
  typeDefs: [
    RootQuery, SchemaDefinition,
    Account.Schema,
    Me.Schema,
    Project.Schema,
    DataSet.Schema,
    Findings.Schema,
    Permits.Schema,
    Street.Schema,
    BuildingProject.Schema,
    Picture.Schema,
    Developers.Schema
  ],
  resolvers: merge(rootResolver,
    Account.Resolver,
    Me.Resolver,
    Project.Resolver,
    DataSet.Resolver,
    Findings.Resolver,
    Permits.Resolver,
    Street.Resolver,
    BuildingProject.Resolver,
    Picture.Resolver,
    Developers.Resolver
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