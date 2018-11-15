import { merge } from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import * as Basics from './Date';

import { Directives, IDScalars, injectIDScalars } from './Directives2';
import { GraphQLField, GraphQLFieldResolver } from 'graphql';
import { wrapAllResolvers } from '../Resolvers';
import { withLogContext } from '../../openland-log/withLogContext';
// import { trace } from 'openland-log/trace';
// import { gqlTracer } from 'openland-graphql/gqlTracer';
import { buildSchema } from 'openland-graphql/buildSchema';
import { buildResolvers } from 'openland-graphql/buildResolvers';
import { AppContext } from 'openland-modules/AppContext';
import { gqlTracer } from 'openland-graphql/gqlTracer';
// import { withTracingSpan } from 'openland-log/withTracing';
// import { withCache } from 'foundation-orm/withCache';

export const Schema = () => {
    let schema = buildSchema(__dirname + '/../../');
    let resolvers = buildResolvers(__dirname + '/../../');

    let executableSchema = makeExecutableSchema({
        typeDefs: injectIDScalars(schema),
        resolvers: merge(
            Basics.Resolvers,
            IDScalars,
            ...resolvers
        ),
        schemaDirectives: Directives
    });
    // return executableSchema;

    return wrapAllResolvers(executableSchema,
        async (
            field: GraphQLField<any, any>,
            originalResolver: GraphQLFieldResolver<any, any, any>,
            root: any,
            args: any,
            context: any,
            info: any
        ) => {
            let ctx = (context as AppContext).ctx;
            ctx = withLogContext(ctx, [field.name]);
            return await gqlTracer.trace(ctx, field.name, async (ctx2) => {
                return await originalResolver(root, args, new AppContext(ctx2), info);
            });
        }
    );
};