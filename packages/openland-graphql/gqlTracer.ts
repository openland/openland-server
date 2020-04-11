import { Context, createContextNamespace } from '@openland/context';
import { GraphQLResolveInfo } from 'graphql';

// const hrTime = () => process.hrtime.bigint();

function fetchResolvePath(info: GraphQLResolveInfo) {
    let path: (string | number)[] = [];
    try {
        let current = info.path;
        path.unshift(current.key);
        while (current.prev) {
            current = current.prev;
            path.unshift(current.key);
        }
    } catch {
        //
    }
    return path;
}

type ResolveTrace = {
    path: (string | number)[];
    startOffset: number
    duration: number
};

export type GqlTrace = {
    name: string,
    traces: ResolveTrace[],
    duration: number
};

export class GQLTracer {
    private startTime!: number;
    private name: string;
    private started = false;
    private traces: ResolveTrace[] = [];
    private endTime!: number;

    constructor(name: string) {
        this.name = name;
    }

    onResolve(info: GraphQLResolveInfo) {
        let path = fetchResolvePath(info);

        // Save start time
        if (!this.started) {
            this.startTime = Date.now();
            this.started = true;
        }

        let resolveStart = Date.now();

        let trace = {
            path,
            startOffset: resolveStart - this.startTime,
            duration: 0
        };

        this.traces.push(trace);

        return () => {
            trace.duration = Date.now() - resolveStart;
        };
    }

    onRequestFinish() {
        this.endTime = Date.now();
    }

    getTrace(): GqlTrace {
        return {
            name: this.name,
            traces: this.traces,
            duration: this.endTime - this.startTime
        };
    }
}

export const gqlTraceNamespace = createContextNamespace<GQLTracer | null>('gql-trace', null);

// const isProd = process.env.APP_ENVIRONMENT === 'production';

export function withGqlTrace(parent: Context, name: string): Context {
    return gqlTraceNamespace.set(parent, new GQLTracer(name));
}

export const GqlQueryIdNamespace = createContextNamespace<string | null>('gql-query-id', null);

export function withGqlQueryId(parent: Context, id: string): Context {
    return GqlQueryIdNamespace.set(parent, id);
}
