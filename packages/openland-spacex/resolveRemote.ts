import { DocumentNode } from 'graphql';
import { getOperation } from './utils/getOperation';
import { getOperationField } from './utils/getOperationField';

export function resolveRemote(document: DocumentNode): string | null {
    const op = getOperation(document);
    if (op.operation === 'subscription') {
        return null;
    }
    const field = getOperationField(op);
    if (!field) {
        return null;
    }

    switch (field) {
        case 'typingCancel':
        case 'typingSend':
            return 'events';
        default:
            return null;
    }
}