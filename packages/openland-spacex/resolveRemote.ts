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

    if (op.operation === 'mutation') {
        switch (field) {
            case 'presenceReportOnline':
            case 'presenceReportOffline':
            case 'typingCancel':
            case 'typingSend':
                return 'events';
            default:
                return null;
        }
    }

    return null;
}