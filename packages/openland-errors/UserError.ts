export class UserError extends Error {
    readonly code: string | undefined;

    constructor(message: string, code?: string) {
        super(message);
        this.code = code;
    }
}