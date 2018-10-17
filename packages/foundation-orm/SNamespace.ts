export class SNamespace {
    readonly namespace: (string | number)[];
    
    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }
}