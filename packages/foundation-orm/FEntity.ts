import { FNamespace } from './FNamespace';
import { FContext } from './FContext';
import { FConnection } from './FConnection';

export class FEntity {
    readonly namespace: FNamespace;
    readonly rawId: (string | number)[];
    readonly connection: FConnection;
    protected _value: any;
    readonly isReadOnly: boolean;
    readonly context: FContext;

    constructor(connection: FConnection, namespace: FNamespace, id: (string | number)[], value: any) {
        this.namespace = namespace;
        this.rawId = id;
        this._value = value;
        this.connection = connection;
        this.context = connection.currentContext;
        this.isReadOnly = connection.currentContext.isReadOnly;
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