import { createSourceEventStream, DocumentNode, execute, GraphQLFieldResolver, GraphQLSchema } from 'graphql';
import Maybe from 'graphql/tsutils/Maybe';
import { isAsyncIterator } from './utils';
import { Context } from '@openland/context';

export async function* gqlSubscribe(
    {
        schema,
        document,
        rootValue,
        fetchContext,
        variableValues,
        operationName,
        fieldResolver,
        subscribeFieldResolver,
        ctx,
        onEventResolveFinish
    }: {
        schema: GraphQLSchema;
        document: DocumentNode;
        rootValue?: any;
        fetchContext?: () => Promise<any>;
        ctx?: any;
        variableValues?: Maybe<{ [key: string]: any }>;
        operationName?: Maybe<string>;
        fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
        subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
        onEventResolveFinish: (ctx: Context, duration: number) => void
    }) {

    const sourcePromise = createSourceEventStream(
        schema,
        document,
        rootValue,
        ctx,
        variableValues as any,
        operationName,
        subscribeFieldResolver,
    );

    const mapSourceToResponse = async (eventCtx: Context, payload: any) => execute(
        schema,
        document,
        payload,
        eventCtx,
        variableValues,
        operationName,
        fieldResolver,
    );

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
