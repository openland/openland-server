import * as express from 'express';
import * as Compose from 'compose-middleware';
import { GraphQLOptions } from 'apollo-server-core';
import { graphqlExpress } from 'apollo-server-express';
import { Schema } from '../../openland-module-api/schema/Schema';
import { callContextMiddleware } from './context';
import { errorHandler, QueryInfo } from '../../openland-errors';
// import { CallContext } from '../../openland-module-api/CallContext';
// import { Rate } from '../../openland-utils/rateLimit';
// import { delay } from '../../openland-utils/timer';
// import { gqlTracer } from 'openland-graphql/gqlTracer';
// import { createEmptyContext } from 'openland-utils/Context';

// function getClientId(req: express.Request, res: express.Response) {
//     if (res.locals.ctx) {
//         let context: CallContext = res.locals.ctx;

//         if (context.uid) {
//             return 'user_' + context.uid;
//         }
//     }

//     return 'ip_' + req.ip;
// }

let schema = Schema();

function handleRequest(withEngine: boolean) {
    return async function (req?: express.Request, res?: express.Response): Promise<GraphQLOptions> {
        if (req === undefined || res === undefined) {
            throw new Error('Unexpected error!');
        } else {
            // let clientId = getClientId(req, res);

            // let handleStatus = Rate.HTTP.canHandle(clientId);

            // if (!handleStatus.canHandle) {
            //     if (handleStatus.delay) {
            //         Rate.HTTP.hit(clientId);
            //         await delay(handleStatus.delay);
            //     } else {
            //         throw new Error('Rate limit!');
            //     }
            // } else {
            //     Rate.HTTP.hit(clientId);
            // }
            return {
                schema: schema,
                context: res.locals.ctx,
                // cacheControl: withEngine,
                tracing: withEngine,
                formatError: (err: any) => {
                    let ctx = res.locals.ctx;
                    let info: QueryInfo = {
                        uid: res.locals.ctx && ctx.auth && ctx.auth.uid,
                        oid: ctx && ctx.auth && ctx.auth.oid,
                        query: JSON.stringify(req.body),
                        transport: 'http'
                    };

                    return {
                        ...errorHandler(err, info),
                        locations: err.locations,
                        path: err.path
                    };
                },
                validationRules: [
                    // disableIntrospection((res.locals.ctx as CallContext) || undefined)
                ]
            };
        }
    };
}

export function schemaHandler(isTest: boolean, withEngine: boolean) {
    let gqlMiddleware = graphqlExpress(handleRequest(withEngine));
    let contestMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        // return await gqlTracer.trace(createEmptyContext(), 'http', async () => {
        return await callContextMiddleware(isTest, req, res, next);
        // });
    };

    return Compose.compose(contestMiddleware as any, gqlMiddleware as any);
}