import { makeExecutableSchema } from 'graphql-tools';
import * as Basics from './Date';

import { Directives } from './Directives2';
import { GraphQLField, GraphQLFieldResolver, GraphQLObjectType } from 'graphql';
import { wrapAllResolvers } from '../Resolvers';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { AppContext, GQLAppContext } from 'openland-modules/AppContext';
import { gqlTracer } from 'openland-graphql/gqlTracer';
import { merge } from '../../openland-utils/merge';

export const Schema = (forTest: boolean = false) => {
    let schema = buildSchema(__dirname + '/../../');
    let resolvers = buildResolvers(__dirname + '/../../', forTest);

    let executableSchema = makeExecutableSchema({
        typeDefs: schema,
        resolvers: merge(
            Basics.Resolvers,
            ...resolvers
        ),
        schemaDirectives: Directives
    });

    if (forTest) {
        return executableSchema;
    }

    return wrapAllResolvers(executableSchema,
        async (
            type: GraphQLObjectType,
            field: GraphQLField<any, any>,
            originalResolver: GraphQLFieldResolver<any, any, any>,
            root: any,
            args: any,
            context: any,
            info: any
        ) => {
            let ctx = (context as AppContext).ctx;
            let name = 'Field:' + field.name;
            if (type.name === 'Query') {
                name = 'Query:' + field.name;
            } else if (type.name === 'Mutation') {
                name = 'Mutation:' + field.name;
            } else if (type.name === 'Subscription') {
                name = 'Subscription:' + field.name;
            }
            return await gqlTracer.trace(ctx, name, async (ctx2) => {
                return await originalResolver(root, args, new GQLAppContext(ctx2, info), info);
            });
        }
    );
};