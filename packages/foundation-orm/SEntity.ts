import { SNamespace } from './SNamespace';
import { SContext } from './SContext';

export class SEntity {
    protected _namespace: SNamespace;
    protected _id: (string | number)[];
    protected _value: any;
    readonly isReadOnly: boolean;
    readonly context: SContext;

    constructor(context: SContext, namespace: SNamespace, id: (string | number)[], value: any) {
        this._namespace = namespace;
        this._id = id;
        this._value = value;
        this.context = context;
        this.isReadOnly = context.isReadOnly;
    }

    protected _checkIsWritable() {
        if (this.isReadOnly) {
            throw Error('Entity is not writable. Did you wrapped everything in transaction?');
        }
    }

    protected _markDirty() {
        this.context.markDirty(this, this._value);
    }
}