import { IDMailformedError } from './IDMailformedError';
import { IDMailformedError as SecIDMalformedError } from '@openland/secure-id/lib/IDMailformedError';
import UUID from 'uuid/v4';
import { NotFoundError } from './NotFoundError';
import { UserError } from './UserError';
import { InvalidInputError } from './InvalidInputError';
// import Raven from 'raven';
import { DoubleInvokeError } from './DoubleInvokeError';
import { AccessDeniedError } from './AccessDeniedError';
// import { IDs } from '../openland-module-api/IDs';
// import { Modules } from '../openland-modules/Modules';
// import { createNamedContext } from '@openland/context';
// import { createLogger } from '@openland/log';

interface FormattedError {
    uuid: string;
    message: string;
    invalidFields?: { key: string, message: string }[] | null;
    code?: number | null;
    error_code?: string;
    doubleInvoke?: boolean;
    shouldRetry?: boolean;
}

export interface QueryInfo {
    uid?: number;
    oid?: number;
    query: string;
    transport: 'http' | 'ws';
}

// const ctx = createNamedContext('unexpected-error');
// const logger = createLogger('error-formatter');

// const handleUnexpectedError = (uuid: string, error: { message: string, originalError: any }, info?: QueryInfo) => {
//     // Raven.captureException(error.originalError);
//     logger.warn(ctx, error.originalError, 'unexpected_error', uuid, error, info);

//     // tslint:disable:no-floating-promises
//     (async () => {
//         if (!await Modules.Super.getEnvVar<boolean>(ctx, 'api-error-reporting-enabled')) {
//             return;
//         }

//         let chatId = await Modules.Super.getEnvVar<number>(ctx, 'api-error-reporting-chat-id');
//         let botId = await Modules.Super.getEnvVar<number>(ctx, 'api-error-reporting-bot-id');

//         if (!chatId || !botId) {
//             return;
//         }

//         let report =
//             ':rotating_light: API Error:\n' +
//             '\n' +
//             ('User: ' + (info && info.uid && 'https://next.openland.com/directory/u/' + IDs.User.serialize(info.uid)) || 'ANON') + '\n' +
//             ('Org: ' + (info && info.oid && 'https://next.openland.com/directory/o/' + IDs.Organization.serialize(info.oid)) || 'ANON') + '\n' +
//             'Query: ' + ((info && info.query) || 'null') + '\n' +
//             'Transport: ' + ((info && info.transport) || 'unknown') + '\n' +
//             '\n' +
//             'Error: ' + error.originalError.message + '\n' +
//             'UUID: ' + uuid;

//         await Modules.Messaging.sendMessage(ctx, chatId, botId, { message: report, ignoreAugmentation: true });
//     })();
// };

export function errorHandler(error: { message: string, originalError: any }): FormattedError {
    let uuid = UUID();
    if (error.originalError instanceof IDMailformedError || error.originalError instanceof SecIDMalformedError) {
        return {
            message: 'Not found',
            code: 404,
            uuid: uuid,
        };
    } else if (error.originalError instanceof NotFoundError) {
        return {
            message: error.originalError.message,
            code: 404,
            uuid: uuid,
        };
    } else if (error.originalError instanceof UserError) {
        return {
            message: error.originalError.message,
            uuid: uuid,
            ...(error.originalError.code ? { error_code: error.originalError.code } : {})
        };
    } else if (error.originalError instanceof AccessDeniedError) {
        return {
            message: error.originalError.message,
            uuid: uuid,
        };
    } else if (error.originalError instanceof InvalidInputError) {
        return {
            message: error.originalError.message,
            invalidFields: error.originalError.fields,
            uuid: uuid,
        };
    } else if (error.originalError instanceof DoubleInvokeError) {
        return {
            message: error.originalError.message,
            doubleInvoke: true,
            uuid: uuid
        };
    } else if (!error.originalError) {
        return {
            message: error.message,
            uuid: uuid,
        };
    } else if ((error as any).extensions) {
        // handleUnexpectedError(uuid, error, info);
        return {
            message: error.message,
            uuid: uuid,
        };
    }

    // handleUnexpectedError(uuid, error, info);

    return {
        message: 'An unexpected error occurred. Please, try again. If the problem persists, please contact support@openland.com.',
        uuid: uuid,
        shouldRetry: true
    };
}
