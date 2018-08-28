import * as express from 'express';
import * as Compose from 'compose-middleware';
import { GraphQLOptions } from 'apollo-server-core';
import { graphqlExpress } from 'apollo-server-express';
import * as Schema from '../api';
import { callContextMiddleware } from './context';
import { errorHandler } from '../errors';

function handleRequest(withEngine: boolean) {
    return async function (req?: express.Request, res?: express.Response): Promise<GraphQLOptions> {
        if (req === undefined || res === undefined) {
            throw new Error('Unexpected error!');
        } else {
            return {
                schema: Schema.Schema,
                context: res.locals.ctx,
                cacheControl: withEngine,
                tracing: withEngine,
                formatError: (err: any) => {
                    return {
                        ...errorHandler(err),
                        locations: err.locations,
                        path: err.path
                    };
                }
            };
        }
    };
}

export function schemaHandler(isTest: boolean, withEngine: boolean) {
    let gqlMiddleware = graphqlExpress(handleRequest(withEngine));
    let contestMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => callContextMiddleware(isTest, req, res, next);
    return Compose.compose(contestMiddleware as any, gqlMiddleware as any);
}