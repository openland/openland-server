export class AccessDeniedError extends Error {
    constructor(message: string = 'Access Denied') {
        super(message);
    }
}