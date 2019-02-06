import { IDMailformedError } from './IDMailformedError';
import UUID from 'uuid/v4';
import { NotFoundError } from './NotFoundError';
import { UserError } from './UserError';
import { InvalidInputError } from './InvalidInputError';
import Raven from 'raven';
import { DoubleInvokeError } from './DoubleInvokeError';
import { AccessDeniedError } from './AccessDeniedError';
import { IDs } from '../openland-module-api/IDs';
import { Modules } from '../openland-modules/Modules';
import { createEmptyContext } from '../openland-utils/Context';

interface FormattedError {
    uuid: string;
    message: string;
    invalidFields?: { key: string, message: string }[] | null;
    code?: number | null;
    doubleInvoke?: boolean;
    shouldRetry?: boolean;
}

export interface QueryInfo {
    uid?: number;
    oid?: number;
    query: string;
    transport: 'http' | 'ws';
}
const IS_PROD = process.env.APP_ENVIRONMENT === 'production';

const ERROR_REPORT_CHAT = IS_PROD ? IDs.Conversation.parse('av6pa90nyruoPV77gnaRhVLWrv') : null;
const ERROR_REPORT_BOT = IS_PROD ? IDs.User.parse('qlO16E1R00cLaQyAmxzgt9xKeR') : null;

export function errorHandler(error: { message: string, originalError: any }, info?: QueryInfo): FormattedError {
    let uuid = UUID();
    if (error.originalError instanceof IDMailformedError) {
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
    }
    Raven.captureException(error.originalError);
    console.warn('unexpected_error', uuid, error.originalError);

    if (IS_PROD) {
        let report =
            ':rotating_light: API Error:\n' +
            '\n' +
            ('User: ' + (info && info.uid && 'https://next.openland.com/directory/u/' + IDs.User.serialize(info.uid)) || 'ANON') + '\n' +
            ('Org: ' + (info && info.oid && 'https://next.openland.com/directory/o/' + IDs.Organization.serialize(info.oid)) || 'ANON') + '\n' +
            'Query: ' + ((info && info.query) || 'null') + '\n' +
            'Transport: ' + ((info && info.transport) || 'unknown') + '\n' +
            '\n' +
            'Error: ' + error.originalError.message + '\n' +
            'UUID: ' + uuid;

        // tslint:disable:no-floating-promises
        (async () => {
            await Modules.Messaging.sendMessage(createEmptyContext(), ERROR_REPORT_CHAT!, ERROR_REPORT_BOT!, { message: report, ignoreAugmentation: true });
        })();
    }

    return {
        message: 'An unexpected error occurred. Please, try again. If the problem persists, please contact support@openland.com.',
        uuid: uuid,
        shouldRetry: true
    };
}