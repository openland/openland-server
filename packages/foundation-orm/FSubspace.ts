export class FSubspace {
    readonly path: (string | number)[];

    constructor(...path: (string | number)[]) {
        this.path = path;
    }
}