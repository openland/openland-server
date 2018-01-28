import { makeExecutableSchema } from 'graphql-tools';
import * as Account from './models/Account';
import * as Me from './models/Me';
import * as Permits from './models/Permit';
import * as Street from './models/Street';
import * as BuildingProject from './models/BuildingProject';
import * as Picture from './models/Picture';
import * as Organizations from './models/Organizations';
import * as Core from './models/Core';
import * as Stats from './models/Stats';
import * as Parcels from './models/Parcels';
import * as Place from './models/Place';
import { merge } from 'lodash';

const RootQuery = `
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
            return 'Hello World!';
        }
    },
    Mutation: {
        healthCheck: async function () {
            return 'Hello World!';
        }
    }
};

export const Schema = makeExecutableSchema({
    typeDefs: [
        Core.Schema,
        RootQuery, SchemaDefinition,
        Account.Schema,
        Me.Schema,
        Permits.Schema,
        Street.Schema,
        BuildingProject.Schema,
        Picture.Schema,
        Organizations.Schema,
        Stats.Schema,
        Parcels.Schema,
        Place.Schema
    ],
    resolvers: merge(rootResolver,
        Account.Resolver,
        Me.Resolver,
        Permits.Resolver,
        Street.Resolver,
        BuildingProject.Resolver,
        Picture.Resolver,
        Organizations.Resolver,
        Stats.Resolver,
        Parcels.Resolver,
        Place.Resolver
    )
});

export const AdminSchema = makeExecutableSchema({
    typeDefs: [
        RootQuery, SchemaDefinition,
        Account.AdminSchema,
    ],
    resolvers: merge(
        // rootResolver,
        Account.AdminResolver
    )
});