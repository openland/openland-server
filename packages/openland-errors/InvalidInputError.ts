export class InvalidInputError extends Error {
    constructor(
        public fields: { key: string, message: string }[]
    ) {
        super(fields[0].message);
    }
}