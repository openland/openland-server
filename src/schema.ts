import { merge } from 'lodash';
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
import * as Permissions from './api/Permissions';
import * as fs from 'fs';

let schema = fs
    .readdirSync(__dirname + '/api/schema/')
    .filter((v) => v.endsWith('.graphql'))
    .map((f) => fs.readFileSync(__dirname + '/api/schema/' + f, 'utf-8'))
    .sort()
    .join('\n');

export const Schema = makeExecutableSchema({
    typeDefs: schema,
    resolvers: merge(
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
        Search.Resolvers,
        Permissions.Resolvers
    )
});