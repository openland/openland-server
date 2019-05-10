import { DocumentNode, getOperationAST } from 'graphql';

export function isAsyncIterator(iterator: any): iterator is AsyncIterable<any> {
    return iterator.hasOwnProperty(Symbol.asyncIterator);
}

export function isSubscriptionQuery(query: DocumentNode, operationName?: string) {
    const operationAST = getOperationAST(query, operationName);

    return !!operationAST && operationAST.operation === 'subscription';
}