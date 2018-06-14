import { CallContext } from '../api/utils/CallContext';
import { IDMailformedError } from './IDMailformedError';
import * as UUID from 'uuid/v4';
import { NotFoundError } from './NotFoundError';
import { UserError } from './UserError';
import { InvalidInputError } from './InvalidInputError';

interface FormattedError {
    uuid: string;
    message: string;
    invalidFields?: { key: string, message: string }[] | null;
    code?: number | null;
}

export function errorHandler(error: { message: string, originalError: any }, context: CallContext): FormattedError {
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
    } else if (!error.originalError) {
        return {
            message: error.message,
            uuid: uuid,
        };
    }
    return {
        message: 'An unexpected error occurred. Please, try again. If the problem persists, please contact support@openland.com.',
        uuid: uuid,
    };
}