import { FNamespace } from './FNamespace';
import { FContext } from './FContext';
import { FConnection } from './FConnection';

export class FEntity {
    readonly namespace: FNamespace;
    readonly rawId: (string | number)[];
    protected _value: any;
    readonly isReadOnly: boolean;
    readonly context: FContext;

    constructor(context: FContext, namespace: FNamespace, id: (string | number)[], value: any) {
        this.namespace = namespace;
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
        this.context.markDirty(this, (connection: FConnection) => {
            this.namespace.set(connection, this._value, ...this.rawId);
        });
    }
}