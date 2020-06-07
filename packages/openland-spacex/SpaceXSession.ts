import { createTracer } from 'openland-log/createTracer';
import { createLogger } from '@openland/log';
import { Config } from 'openland-config/Config';
import { ConcurrencyPool } from 'openland-utils/ConcurrencyPool';
import { Concurrency } from './../openland-server/concurrency';
import uuid from 'uuid/v4';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Context, createNamedContext } from '@openland/context';
import { DocumentNode, GraphQLSchema, execute } from 'graphql';
import { getOperationType } from './utils/getOperationType';

export type SpaceXSessionDescriptor = { type: 'anonymnous' } | { type: 'authenticated', uid: number, tid: string };

export interface SpaceXSessionParams {
    descriptor: SpaceXSessionDescriptor;
    schema: GraphQLSchema;
}

export type OpResult = {
    type: 'data';
    data: any;
} | {
    type: 'errors';
    errors: any[];
} | {
    type: 'aborted';
};

export type OpRef = {
    cancel: () => void;
};

let activeSessions = new Map<string, SpaceXSession>();
const spaceXCtx = createNamedContext('spacex');
const logger = createLogger('spacex');
const tracer = createTracer('spacex');

export class SpaceXSession {
    readonly uuid = uuid();
    readonly descriptor: SpaceXSessionDescriptor;
    private readonly schema: GraphQLSchema;
    private readonly concurrencyPool: ConcurrencyPool;
    private closed = false;
    private activeOperations = new Map<string, () => void>();

    constructor(params: SpaceXSessionParams) {
        this.descriptor = params.descriptor;
        this.schema = params.schema;
        Metrics.SpaceXSessions.inc();
        if (this.descriptor.type === 'authenticated') {
            Metrics.SpaceXSessionsAuthenticated.inc();
        } else if (this.descriptor.type === 'anonymnous') {
            Metrics.SpaceXSessionsAnonymous.inc();
        }

        // Keep session in memory until explicitly closed to avoid
        // invalid metrics
        activeSessions.set(this.uuid, this);

        // Resolve concurrency pool
        if (this.descriptor.type === 'anonymnous') {
            this.concurrencyPool = Concurrency.Default;
        } else {
            this.concurrencyPool = Concurrency.Execution.get(this.descriptor.tid);

            if (Config.environment === 'debug') {
                logger.log(spaceXCtx, 'Session started');
            }
        }
    }

    operation(parentContext: Context, document: DocumentNode, variables: any, handler: (result: OpResult) => void): OpRef {
        if (this.closed) {
            throw Error('Session already closed');
        }
        let completed = false;
        let id = uuid();
        let abort = () => {
            if (!completed) {
                completed = true;
                handler({ type: 'aborted' });
            }
            if (this.activeOperations.has(id)) {
                Metrics.SpaceXOperations.dec();
                this.activeOperations.delete(id);
            }
        };
        Metrics.SpaceXOperations.inc();
        Metrics.SpaceXOperationsFrequence.inc();
        this.activeOperations.set(id, abort);

        // tslint:disable-next-line:no-floating-promises
        (async () => {
            try {
                // We are doing check here to have a single place to throw errors
                let docOp = getOperationType(document);
                if (docOp !== 'query' && docOp !== 'mutation') {
                    throw Error('Invalid operation type');
                }

                // Executing in concurrency pool
                let res = await tracer.trace(parentContext, docOp, async (context) => {
                    return await this.concurrencyPool.run(async () => {
                        if (completed) {
                            return null;
                        }
                        return await execute({
                            schema: this.schema,
                            document: document,
                            variableValues: variables,
                            contextValue: context
                        });
                    });
                });

                // Complete if is not already
                if (!res) {
                    return;
                }
                if (completed) {
                    return;
                }
                completed = true;

                // This handlers could throw errors, but they are ignored since we are already 
                // in completed state
                if (res.errors) {
                    handler({ type: 'errors', errors: [...res.errors!] });
                } else {
                    handler({ type: 'data', data: res.data });
                }
            } catch (e) {
                if (completed) {
                    return;
                }
                completed = true;
                handler({ type: 'errors', errors: [e] });
            } finally {
                // Cleanup
                completed = true;
                abort();
            }
        })();

        return {
            cancel: abort
        };
    }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        activeSessions.delete(this.uuid);
        Metrics.SpaceXSessions.dec();
        if (this.descriptor.type === 'authenticated') {
            Metrics.SpaceXSessionsAuthenticated.dec();
        } else if (this.descriptor.type === 'anonymnous') {
            Metrics.SpaceXSessionsAnonymous.dec();
        }
        for (let op of [...this.activeOperations.values()]) {
            op();
        }
        if (Config.environment === 'debug') {
            logger.log(spaceXCtx, 'Session stopped');
        }
    }
}