import { makeExecutableSchema } from 'graphql-tools';
import { merge } from 'lodash';
import * as Basics from './_Basics';
import * as Account from './Account';
import * as User from './User';
import * as Permissions from './Permissions';
import * as Debug from './Debug';
import * as Organization from './Organization';
import * as Chat from './Chat';
import * as Push from './Push';
import * as Channels from './Channels';
import * as ShortName from './ShortName';
import { Directives, IDScalars } from './directives';
import * as Developer from './Developer';
import { buildSchema } from '../../openland-graphql/buildSchema';
import { buildResolvers } from '../../openland-graphql/buildResolvers';

let schema = buildSchema(__dirname + '/../../');
let resolvers = buildResolvers(__dirname + '/../../');

describe('GQLSchema', () => {
    it('should be valid', () => {
        const spy = jest.spyOn(global.console, 'warn');
        const spy2 = jest.spyOn(global.console, 'error');

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
                Developer.Resolver,
                ...resolvers
            ),
            schemaDirectives: Directives
        });

        expect(spy).not.toHaveBeenCalled();
        expect(spy2).not.toHaveBeenCalled();
    });
});