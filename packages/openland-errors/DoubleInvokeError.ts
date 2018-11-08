export class DoubleInvokeError extends Error {
    constructor(message: string = 'Double Invoke Error') {
        super(message);
    }
}