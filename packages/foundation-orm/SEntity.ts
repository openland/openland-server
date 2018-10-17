import { SNamespace } from './SNamespace';

export class SEntity {
    protected _namespace: SNamespace;
    protected _id: (string | number)[];
    protected _value: any;
    readonly isReadOnly: boolean;

    protected constructor(namespace: SNamespace, id: (string | number)[], value: any, isReadOnly: boolean) {
        this._namespace = namespace;
        this._id = id;
        this._value = value;
        this.isReadOnly = isReadOnly;
    }
}