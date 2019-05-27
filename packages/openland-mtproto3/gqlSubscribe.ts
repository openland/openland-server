import { createSourceEventStream, DocumentNode, execute, GraphQLFieldResolver, GraphQLSchema } from 'graphql';
import Maybe from 'graphql/tsutils/Maybe';
import { isAsyncIterator } from './utils';

export async function* gqlSubscribe(
    {
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        subscribeFieldResolver,
    }: {
        schema: GraphQLSchema;
        document: DocumentNode;
        rootValue?: any;
        contextValue?: () => Promise<any>;
        variableValues?: Maybe<{ [key: string]: any }>;
        operationName?: Maybe<string>;
        fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
        subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
    }) {

    const sourcePromise = createSourceEventStream(
        schema,
        document,
        rootValue,
        contextValue ? await contextValue() : undefined,
        variableValues as any,
        operationName,
        subscribeFieldResolver,
    );

    const mapSourceToResponse = async (payload: any) => execute(
        schema,
        document,
        payload,
        contextValue ? await contextValue() : undefined,
        variableValues,
        operationName,
        fieldResolver,
    );

    let res = await sourcePromise;

    if (isAsyncIterator(res)) {
        try {
            for await (let data of res) {
                yield await mapSourceToResponse(data);
            }
        } catch (e) {
            yield {errors: [e]};
        }
    } else {
        return res;
    }
}
