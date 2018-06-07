import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as CityAccount from './api/CityAccount';
import * as User from './api/User';
import * as Permits from './api/Permit';
import * as BuildingProject from './api/BuildingProject';
import * as Picture from './api/Picture';
import * as CityOrganizations from './api/CityOrganizations';
import * as Stats from './api/AreaStats';
import * as Parcels from './api/Parcels';
import * as Area from './api/Area';
import * as CityIncidents from './api/CityIncident';
import * as Search from './api/Search';
import * as Permissions from './api/Permissions';
import * as Account from './api/Account';
import * as Addressing from './api/Addressing';
import * as Deals from './api/Deals';
import * as Sourcing from './api/Sourcing';
import * as fs from 'fs';
import * as Services from './api/Services';
import * as Debug from './api/Debug';
import * as Folder from './api/Folder';
import * as Organization from './api/Organization';

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
        User.Resolver,
        Permits.Resolver,
        BuildingProject.Resolver,
        Picture.Resolver,
        Stats.Resolver,
        Parcels.Resolver,
        Area.Resolver,
        CityAccount.Resolver,
        CityOrganizations.Resolver,
        CityIncidents.Resolvers,
        Search.Resolvers,
        Permissions.Resolvers,
        Addressing.Resolvers,
        Deals.Resolver,
        Sourcing.Resolver,
        Services.Resolvers,
        Debug.Resolver,
        Folder.Resolver,
        Organization.Resolver,
    )
});