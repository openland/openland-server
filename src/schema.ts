import { makeExecutableSchema } from 'graphql-tools';
import * as Account from './api/Account';
import * as Me from './api/Me';
import * as Permits from './api/Permit';
import * as BuildingProject from './api/BuildingProject';
import * as Picture from './api/Picture';
import * as Organizations from './api/Organizations';
import * as Stats from './api/AreaStats';
import * as Parcels from './api/Parcels';
import * as Area from './api/Area';
import * as Incidents from './api/Incident';
import * as Search from './api/Search';
import * as fs from 'fs';
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

let schemas = fs
    .readdirSync(__dirname + '/api/')
    .filter((v) => v.endsWith('.graphql'))
    .map((f) => fs.readFileSync(__dirname + '/api/' + f, 'utf-8'))
    .sort();

export const Schema = makeExecutableSchema({
    typeDefs: [
        RootQuery,
        SchemaDefinition,
        ...schemas
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
        Area.Resolver,
        Incidents.Resolvers,
        Search.Resolvers
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