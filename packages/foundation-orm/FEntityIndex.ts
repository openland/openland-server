export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    readonly unique: boolean;

    constructor(name: string, fields: string[], unique: boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
    }
}