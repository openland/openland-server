import { createSourceEventStream, DocumentNode, execute, GraphQLFieldResolver, GraphQLSchema } from 'graphql';
import Maybe from 'graphql/tsutils/Maybe';
import { isAsyncIterator } from './utils';

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
        onEventResolveFinish: (duration: number) => void
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

    const mapSourceToResponse = async (payload: any) => execute(
        schema,
        document,
        payload,
        fetchContext ? await fetchContext() : undefined,
        variableValues,
        operationName,
        fieldResolver,
    );

    let res = await sourcePromise;

    if (isAsyncIterator(res)) {
        try {
            for await (let data of res) {
                let resolveStart = Date.now();
                let event = await mapSourceToResponse(data);
                onEventResolveFinish(Date.now() - resolveStart);
                yield event;
            }
        } catch (e) {
            yield {errors: [e]};
        }
    } else {
        return res;
    }
}
