import { Modules } from './../openland-modules/Modules';
import { DocumentNode } from 'graphql';
import { getOperation } from './utils/getOperation';
import { getOperationField } from './utils/getOperationField';

export function resolveRemote(document: DocumentNode): string | null {

    // Get operation
    const op = getOperation(document);

    // Resolve specific mutations
    const field = getOperationField(op);
    if (field && op.operation === 'mutation') {
        switch (field) {
            case 'presenceReportOnline':
            case 'presenceReportOffline':
            case 'typingCancel':
            case 'typingSend':
                return 'events';
            default:
            /* Nothing */
        }
    }

    // Subscriptions
    if (op.operation === 'subscription') {
        if (Modules.Super.getBoolean('spacex-route-subscriptions', false)) {
            switch (field) {
                case 'alphaSubscribeOnline':
                case 'chatOnlinesCount':
                case 'typings':
                case 'watchSettings':
                case 'settingsWatch':
                case 'alphaConferenceMediaWatch':
                case 'alphaConferenceWatch':
                    return 'default';
                default:
                    return null;
            }
        } else {
            return null;
        }
        // if (Modules.Super.getBoolean('spacex-route-subscriptions', false)) {
        //     return 'default';
        // } else {
        //     return null;
        // }
    }

    // Route everything to default
    if (Modules.Super.getBoolean('spacex-route-all', false)) {
        return 'default';
    } else {
        return null;
    }
}