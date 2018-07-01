import * as express from 'express';
import * as Compose from 'compose-middleware';
import { GraphQLOptions } from 'apollo-server-core';
import { graphqlExpress } from 'apollo-server-express';
import * as Schema from '../api/index';
import { callContextMiddleware } from './context';
import { errorHandler } from '../errors';

function handleRequest(useEngine: boolean) {
    return async function (req?: express.Request, res?: express.Response): Promise<GraphQLOptions> {
        if (req === undefined || res === undefined) {
            throw new Error('Unexpected error!');
        } else {
            return {
                schema: Schema.Schema,
                context: res.locals.ctx,
                cacheControl: useEngine,
                tracing: useEngine,
                formatError: (err: any) => {
                    return {
                        ...errorHandler(err, res.locals.ctx),
                        locations: err.locations,
                        path: err.path
                    };
                }
            };
        }
    };
}

export function schemaHandler(useEngine: boolean) {
    let gqlMiddleware = graphqlExpress(handleRequest(useEngine));
    return Compose.compose(callContextMiddleware as any, gqlMiddleware as any);
}