import { FNamespace } from './FNamespace';
import { FContext } from './FContext';
import { FConnection } from './FConnection';

export interface FEntityOptions {
    enableVersioning: boolean;
    enableTimestamps: boolean;
}

export class FEntity {
    readonly namespace: FNamespace;
    readonly rawId: (string | number)[];
    readonly connection: FConnection;
    protected _value: any;
    readonly isReadOnly: boolean;
    readonly context: FContext;
    private options: FEntityOptions;
    private isDirty: boolean = false;
    private isNew: boolean;

    constructor(connection: FConnection, namespace: FNamespace, id: (string | number)[], value: any, options: FEntityOptions, isNew: boolean) {
        this.namespace = namespace;
        this.rawId = id;
        this._value = value;
        this.connection = connection;
        this.context = connection.currentContext;
        this.isReadOnly = connection.currentContext.isReadOnly;
        this.options = options;
        this.isNew = isNew;
        if (this.isNew) {
            this.markDirty();
        }
    }

    get entityVersion(): number {
        if (this.options.enableVersioning) {
            return this._value._version ? this._value._version as number : 0;
        } else {
            return 0;
        }
    }

    get entityCreatedAt(): number {
        if (this.options.enableTimestamps) {
            return this._value._createdAt ? this._value._createdAt as number : 0;
        } else {
            return 0;
        }
    }

    get entityUpdatedAt(): number {
        if (this.options.enableTimestamps) {
            return this._value._updatedAt ? this._value._updatedAt as number : 0;
        } else {
            return 0;
        }
    }

    protected _checkIsWritable() {
        if (this.isReadOnly) {
            throw Error('Entity is not writable. Did you wrapped everything in transaction?');
        }
    }

    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            this.context.markDirty(this, (connection: FConnection) => {
                let value = {
                    ...this._value
                };
                if (this.options.enableVersioning) {
                    value._version = this.entityVersion + 1;
                }
                if (this.options.enableTimestamps) {
                    let now = Date.now();
                    if (!value._createdAt) {
                        value._createdAt = now;
                    }
                    value._updatedAt = now;
                }
                console.log('FEntity updated', { entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: value });
                this.namespace.set(connection, value, ...this.rawId);
            });
        }
    }
}