import { CallContext } from '../api/utils/CallContext';
import { IDMailformedError } from './IDMailformedError';
import * as UUID from 'uuid/v4';
import { NotFoundError } from './NotFoundError';
import { UserError } from './UserError';

interface FormattedError {
    uuid: string;
    message: string;
    code?: number | null;
}

export function errorHandler(error: { message: string, originalError: any }, context: CallContext): FormattedError {
    let uuid = UUID();
    if (error.originalError instanceof IDMailformedError) {
        return {
            uuid: uuid,
            message: 'Not found',
            code: 404
        };
    } else if (error.originalError instanceof NotFoundError) {
        return {
            uuid: uuid,
            message: error.originalError.message,
            code: 404
        };
    } else if (error.originalError instanceof UserError) {
        return {
            uuid: uuid,
            message: error.originalError.message
        };
    }
    return {
        uuid: uuid,
        message: 'An unexpected error occurred. Please, try again. If the problem continues, please contact support@openland.com.'
    };
}