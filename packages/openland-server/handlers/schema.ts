import * as express from 'express';
import * as Compose from 'compose-middleware';
import { GraphQLOptions } from 'apollo-server-core';
import { graphqlExpress } from 'apollo-server-express';
import * as Schema from '../api';
import { callContextMiddleware } from './context';
import { errorHandler } from '../errors';
import { CallContext } from '../api/utils/CallContext';
import { Rate } from '../utils/rateLimit';
import { delay } from '../utils/timer';
import { withTracing } from 'openland-log/withTracing';
import { gqlTracer } from 'openland-server/utils/gqlTracer';
import { withLogContext } from 'openland-log/withLogContext';
import { createTracer } from 'openland-log/createTracer';
import { OpenTracer } from 'openland-log/src/STracer';

const OpentracingExtension = require('apollo-opentracing').default;
const tracer = createTracer('graphql');
const tracerResolve = createTracer('resolve');

function getClientId(req: express.Request, res: express.Response) {
    if (res.locals.ctx) {
        let context: CallContext = res.locals.ctx;

        if (context.uid) {
            return 'user_' + context.uid;
        }
    }

    return 'ip_' + req.ip;
}

function handleRequest(withEngine: boolean) {
    return async function (req?: express.Request, res?: express.Response): Promise<GraphQLOptions> {
        if (req === undefined || res === undefined) {
            throw new Error('Unexpected error!');
        } else {
            let clientId = getClientId(req, res);

            let handleStatus = Rate.HTTP.canHandle(clientId);

            if (!handleStatus.canHandle) {
                if (handleStatus.delay) {
                    Rate.HTTP.hit(clientId);
                    await delay(handleStatus.delay);
                } else {
                    throw new Error('Rate limit!');
                }
            } else {
                Rate.HTTP.hit(clientId);
            }

            return {
                schema: Schema.Schema,
                context: res.locals.ctx,
                cacheControl: withEngine,
                tracing: withEngine,
                extensions: tracer instanceof OpenTracer ? [() => new OpentracingExtension({
                    server: (tracer as OpenTracer).tracer,
                    local: (tracerResolve as OpenTracer).tracer,
                })] : [],
                formatError: (err: any) => {
                    return {
                        ...errorHandler(err),
                        locations: err.locations,
                        path: err.path
                    };
                },
                validationRules: [
                    // disableIntrospection((res.locals.ctx as CallContext) || undefined)
                ]
            } as any;
        }
    };
}

export function schemaHandler(isTest: boolean, withEngine: boolean) {
    let gqlMiddleware = graphqlExpress(handleRequest(withEngine));
    let contestMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        return await withTracing(gqlTracer, 'http', async () => {
            return await withLogContext('http', async () => {
                return await callContextMiddleware(isTest, req, res, next);
            });
        });
    };

    return Compose.compose(contestMiddleware as any, gqlMiddleware as any);
}