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
import * as Developer from './Developer';

import { Directives, IDScalars } from './directives';
import { GraphQLField, GraphQLFieldResolver } from 'graphql';
import { wrapAllResolvers } from './utils/Resolvers';
import { withLogContext } from '../../openland-log/withLogContext';
import { trace } from 'openland-log/trace';
import { gqlTracer } from 'openland-server/utils/gqlTracer';

let schema = fs
    .readdirSync(__dirname + '/schema/')
    .filter((v) => v.endsWith('.graphql'))
    .map((f) => fs.readFileSync(__dirname + '/schema/' + f, 'utf-8'))
    .sort()
    .join('\n');

export const Schema = wrapAllResolvers(
    makeExecutableSchema({
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
            IDScalars,
            Developer.Resolver
        ),
        schemaDirectives: Directives
    }),
    async (
        field: GraphQLField<any, any>,
        originalResolver: GraphQLFieldResolver<any, any, any>,
        root: any,
        args: any,
        context: any,
        info: any
    ) => {
        return await trace(gqlTracer, field.name, async () => await withLogContext(field.name, async () => await originalResolver(root, args, context, info)));
    }
);
