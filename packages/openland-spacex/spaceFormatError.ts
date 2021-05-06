import { errorHandler } from 'openland-errors';

export function spaceFormatError(err: any) {
    return {
        ...errorHandler(err),
        locations: err.locations,
        path: err.path
    };
}