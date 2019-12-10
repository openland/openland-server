import { DocumentNode, getOperationAST } from 'graphql';
import { randomBytes } from 'crypto';

export function isAsyncIterator(iterator: any): iterator is AsyncIterable<any> {
    return !!iterator[Symbol.asyncIterator];
}

export function isSubscriptionQuery(query: DocumentNode, operationName?: string) {
    const operationAST = getOperationAST(query, operationName);

    return !!operationAST && operationAST.operation === 'subscription';
}

export const asyncRun = (handler: () => Promise<any>) => {
    // tslint:disable-next-line:no-floating-promises
    handler();
};

export const makeMessageId = () => Buffer.from(randomBytes(8)).readUInt32BE(0);

export const messageIdToInt = (messageId: Buffer|Uint8Array) => {
    if (messageId instanceof Buffer) {
        return messageId.readInt32BE(0);
    } else {
        return Buffer.from(messageId).readInt32BE(0);
    }
};