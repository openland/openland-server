import { makeExecutableSchema } from 'graphql-tools';
import { merge } from 'lodash';
import * as Basics from './_Basics';
import { Directives, IDScalars, injectIDScalars } from './directives';
import { buildSchema } from '../../openland-graphql/buildSchema';
import { buildResolvers } from '../../openland-graphql/buildResolvers';

let schema = buildSchema(__dirname + '/../../');
let resolvers = buildResolvers(__dirname + '/../../');

describe('GQLSchema', () => {
    it('should be valid', () => {
        makeExecutableSchema({
            typeDefs: injectIDScalars(schema),
            resolvers: merge(
                Basics.Resolvers,
                IDScalars,
                ...resolvers
            ),
            schemaDirectives: Directives
        });
    });
});