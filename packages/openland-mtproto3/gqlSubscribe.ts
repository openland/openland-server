import { createSourceEventStream, DocumentNode, GraphQLSchema } from 'graphql';
import Maybe from 'graphql/tsutils/Maybe';
import { isAsyncIterator } from './utils';
import { Context } from '@openland/context';
import { execute } from 'openland-module-api/execute';

export async function* gqlSubscribe(
    {
        schema,
        document,
        fetchContext,
        variableValues,
        operationName,
        ctx,
        onEventResolveFinish
    }: {
        schema: GraphQLSchema;
        document: DocumentNode;
        fetchContext?: () => Promise<any>;
        ctx?: any;
        variableValues?: Maybe<{ [key: string]: any }>;
        operationName?: Maybe<string>;
        onEventResolveFinish: (ctx: Context, duration: number) => void
    }) {

    const sourcePromise = createSourceEventStream(
        schema,
        document,
        undefined /* Root Value */,
        ctx,
        variableValues ? variableValues : undefined,
        operationName
    );

    const mapSourceToResponse = async (eventCtx: Context, payload: any) => execute(eventCtx, {
        schema,
        document,
        rootValue: payload,
        contextValue: eventCtx,
        variableValues,
        operationName
    });

    let res = await sourcePromise;

    if (isAsyncIterator(res)) {
        try {
            for await (let data of res) {
                let resolveStart = Date.now();
                let eventCtx = fetchContext ? await fetchContext() : undefined;
                let event = await mapSourceToResponse(eventCtx, data);
                onEventResolveFinish(eventCtx, Date.now() - resolveStart);
                yield event;
            }
        } catch (e) {
            yield { errors: [e] };
        }
        return;
    } else {
        return res;
    }
}
