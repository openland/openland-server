import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as User from './User';
import * as Permits from './Permit';
import * as Basics from './_Basics';
import * as Search from './Search';
import * as Permissions from './Permissions';
import * as Account from './Account';
import * as Addressing from './Addressing';
import * as Deals from './Deals';
import * as Opportunity from './Opportunity';
import * as fs from 'fs';
import * as Services from './Services';
import * as Debug from './Debug';
import * as Folder from './Folder';
import * as Organization from './Organization';
import * as Chat from './Chat';
import * as Push from './Push';
import * as Wall from './Wall';
import * as Hits from './Hits';
import * as Channels from './Channels';
import * as ShortName from './ShortName';

import * as Parcels from './Parcels';
import { Directives, IDScalars } from './directives';

let schema = fs
    .readdirSync(__dirname + '/schema/')
    .filter((v) => v.endsWith('.graphql'))
    .map((f) => fs.readFileSync(__dirname + '/schema/' + f, 'utf-8'))
    .sort()
    .join('\n');

export const Schema = makeExecutableSchema({
    typeDefs: schema,
    resolvers: merge(
        Basics.Resolvers,
        Account.Resolver,
        User.Resolver,
        Permits.Resolver,
        Parcels.Resolver,
        Search.Resolvers,
        Permissions.Resolvers,
        Addressing.Resolvers,
        Deals.Resolver,
        Opportunity.Resolver,
        Services.Resolvers,
        Debug.Resolver,
        Folder.Resolver,
        Organization.Resolver,
        Chat.Resolver,
        Push.Resolvers,
        Wall.Resolver,
        Hits.Resolver,
        Channels.Resolver,
        ShortName.Resolvers,
        IDScalars
    ),
    schemaDirectives: Directives
});