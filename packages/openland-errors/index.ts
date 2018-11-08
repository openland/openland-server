import { IDMailformedError } from './IDMailformedError';
import UUID from 'uuid/v4';
import { NotFoundError } from './NotFoundError';
import { UserError } from './UserError';
import { InvalidInputError } from './InvalidInputError';
import Raven from 'raven';
import { DoubleInvokeError } from './DoubleInvokeError';

interface FormattedError {
    uuid: string;
    message: string;
    invalidFields?: { key: string, message: string }[] | null;
    code?: number | null;
    doubleInvoke?: boolean;
    shouldRetry?: boolean;
}

export function errorHandler(error: { message: string, originalError: any }): FormattedError {
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
    console.warn('unexpected_error', error.originalError);
    return {
        message: 'An unexpected error occurred. Please, try again. If the problem persists, please contact support@openland.com.',
        uuid: uuid,
        shouldRetry: true
    };
}