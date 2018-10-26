import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as User from './User';
import * as Basics from './_Basics';
import * as Permissions from './Permissions';
import * as Account from './Account';
import * as fs from 'fs';
import * as Debug from './Debug';
import * as Organization from './Organization';
import * as Chat from './Chat';
import * as Push from './Push';
import * as Channels from './Channels';
import * as ShortName from './ShortName';
import * as Phone from './Phone';
import * as Developer from './Developer';

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
        Permissions.Resolvers,
        Debug.Resolver,
        Organization.Resolver,
        Chat.Resolver,
        Push.Resolvers,
        Channels.Resolver,
        ShortName.Resolvers,
        Phone.Resolvers,
        IDScalars,
        Developer.Resolver
    ),
    schemaDirectives: Directives
});
