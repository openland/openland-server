import { Modules } from './../openland-modules/Modules';
import { DocumentNode } from 'graphql';
import { getOperation } from './utils/getOperation';
import { getOperationField } from './utils/getOperationField';

export function resolveRemoteSubscription(document: DocumentNode): string | null {
    const op = getOperation(document);
    const field = getOperationField(op);
    if (op.operation !== 'subscription') {
        return null;
    }

    if (Modules.Super.getBoolean('spacex-route-remote-subscriptions', false)) {
        switch (field) {
            case 'typings':
                return 'default';
            default:
            /* Nothing */
        }
    }

    return null;
}

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
                // Ephemeral events
                case 'alphaSubscribeOnline':
                case 'chatOnlinesCount':
                case 'typings':
                case 'watchSettings':
                case 'settingsWatch':
                    return 'events';
                // Generic
                case 'myStickersUpdates':
                case 'blackListUpdates':
                case 'walletUpdates':
                    return 'default';
                // Calls
                case 'alphaConferenceMediaWatch':
                case 'alphaConferenceWatch':
                case 'voiceChatEvents':
                case 'voiceChatWatch':
                case 'activeVoiceChatsEvents':
                    return 'calls-events';
                // Chat
                case 'notificationCenterUpdates':
                case 'dialogsUpdates':
                case 'chatUpdates':
                    return 'chat-events';
                default:
                /* Nothing */
            }
        }

        return null;
    }

    // Route everything to default
    if (Modules.Super.getBoolean('spacex-route-all', false)) {
        return 'default';
    } else {
        return null;
    }
}