import { makeExecutableSchema } from 'graphql-tools';
import * as Account from './api/Account';
import * as Me from './api/Me';
import * as Permits from './api/Permit';
import * as BuildingProject from './api/BuildingProject';
import * as Picture from './api/Picture';
import * as Organizations from './api/Organizations';
import * as Core from './api/Core';
import * as Stats from './api/AreaStats';
import * as Parcels from './api/Parcels';
import * as Area from './api/Area';
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
        BuildingProject.Schema,
        Picture.Schema,
        Organizations.Schema,
        Stats.Schema,
        Parcels.Schema,
        Area.Schema
    ],
    resolvers: merge(rootResolver,
        Account.Resolver,
        Me.Resolver,
        Permits.Resolver,
        BuildingProject.Resolver,
        Picture.Resolver,
        Organizations.Resolver,
        Stats.Resolver,
        Parcels.Resolver,
        Area.Resolver
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