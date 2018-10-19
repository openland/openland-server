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
    readonly isReadOnly: boolean;
    readonly context: FContext;

    protected _valueInitial: any;
    protected _value: any;
    private options: FEntityOptions;
    private isDirty: boolean = false;
    private isNew: boolean;

    constructor(connection: FConnection, namespace: FNamespace, id: (string | number)[], value: any, options: FEntityOptions, isNew: boolean) {
        this.namespace = namespace;
        this.rawId = id;
        this.connection = connection;
        this.context = connection.currentContext;
        this.isReadOnly = connection.currentContext.isReadOnly;
        this.options = options;
        this.isNew = isNew;

        let v = { ...value };
        if (this.isNew) {
            let now = Date.now();
            if (!v.createdAt) {
                v.createdAt = now;
            }
            v.updatedAt = now;
        }
        if (this.isNew) {
            this.markDirty();
        }
        this._value = v;
        this._valueInitial = v;
    }

    get versionCode(): number {
        if (this.options.enableVersioning) {
            return this._value._version ? this._value._version as number : 0;
        } else {
            return 0;
        }
    }

    get createdAt(): number {
        if (this.options.enableTimestamps) {
            return this._value.createdAt ? this._value.createdAt as number : 0;
        } else {
            return 0;
        }
    }

    get updatedAt(): number {
        if (this.options.enableTimestamps) {
            return this._value.updatedAt ? this._value.updatedAt as number : 0;
        } else {
            return 0;
        }
    }

    protected _checkIsWritable() {
        if (this.isReadOnly) {
            throw Error('Entity is not writable. Did you wrapped everything in transaction?');
        }
        if (this.context.isCompleted) {
            throw Error('You can\'t update entity when transaction is in completed state.');
        }
    }

    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            this.context.markDirty(this, async (connection: FConnection) => {
                let value = {
                    ...this._value
                };
                if (this.options.enableVersioning) {
                    value._version = this.versionCode + 1;
                }
                if (this.options.enableTimestamps && !this.isNew) {
                    let now = Date.now();
                    if (!value.createdAt) {
                        value.createdAt = now;
                    }
                    value.updatedAt = now;
                }
                // console.log('FEntity updated', { entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: value });
                await this.namespace.set(connection, value, ...this.rawId);
            });
        }
    }
}