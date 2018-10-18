import { FNamespace } from './FNamespace';
import { FContext } from './FContext';

export class FEntity {
    protected _namespace: FNamespace;
    readonly rawId: (string | number)[];
    protected _value: any;
    readonly isReadOnly: boolean;
    readonly context: FContext;

    constructor(context: FContext, namespace: FNamespace, id: (string | number)[], value: any) {
        this._namespace = namespace;
        this.rawId = id;
        this._value = value;
        this.context = context;
        this.isReadOnly = context.isReadOnly;
    }

    protected _checkIsWritable() {
        if (this.isReadOnly) {
            throw Error('Entity is not writable. Did you wrapped everything in transaction?');
        }
    }

    markDirty() {
        this.context.markDirty(this, this._value);
    }
}