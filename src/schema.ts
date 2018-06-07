import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as User from './api/User';
import * as Permits from './api/Permit';

import * as Search from './api/Search';
import * as Permissions from './api/Permissions';
import * as Account from './api/Account';
import * as Addressing from './api/Addressing';
import * as Deals from './api/Deals';
import * as Opportunity from './api/Opportunity';
import * as fs from 'fs';
import * as Services from './api/Services';
import * as Debug from './api/Debug';
import * as Folder from './api/Folder';
import * as Organization from './api/Organization';

import * as CityAccount from './api/compat/CityAccount';
import * as Picture from './api/compat/Picture';
import * as BuildingProject from './api/compat/BuildingProject';
import * as CityOrganizations from './api/compat/CityOrganizations';
import * as Stats from './api/compat/AreaStats';
import * as Area from './api/compat/Area';
import * as Parcels from './api/Parcels';

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
        Search.Resolvers,
        Permissions.Resolvers,
        Addressing.Resolvers,
        Deals.Resolver,
        Opportunity.Resolver,
        Services.Resolvers,
        Debug.Resolver,
        Folder.Resolver,
        Organization.Resolver,
    )
});