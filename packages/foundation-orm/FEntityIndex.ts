export class FEntityIndex {
    readonly name: string;
    readonly fields: string[];
    
    constructor(name: string, fields: string[]) {
        this.name = name;
        this.fields = fields;
    }
}