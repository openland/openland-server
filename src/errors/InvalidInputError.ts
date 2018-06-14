export class InvalidInputError extends Error {
    fields: { key: string, message: string }[];
    constructor(fields: { key: string, message: string }[]) {
        super(fields[0].message);
        this.fields = fields;
    }
}