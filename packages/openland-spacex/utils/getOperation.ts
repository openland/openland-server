import { DocumentNode, getOperationAST } from 'graphql';

export function getOperation(query: DocumentNode, operationName?: string) {
    const operationAST = getOperationAST(query, operationName);
    if (!operationAST) {
        throw Error('Unable to find operation');
    }

    return operationAST;
}