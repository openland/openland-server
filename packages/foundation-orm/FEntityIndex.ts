export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    readonly unique: boolean;
    readonly condition?: (src: any) => boolean;

    constructor(name: string, fields: string[], unique: boolean, condition?: (src: any) => boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
        this.condition = condition;
    }
}