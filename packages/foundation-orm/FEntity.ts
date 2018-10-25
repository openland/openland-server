import { FNamespace } from './FNamespace';
import { FContext } from './FContext';
import { FConnection } from './FConnection';
import { FEntityIndex } from './FEntityIndex';
import { createLogger } from 'openland-log/createLogger';

export interface FEntityOptions {
    enableVersioning: boolean;
    enableTimestamps: boolean;
}

const log = createLogger('FEntity');

export class FEntity {
    readonly namespace: FNamespace;
    readonly rawId: (string | number)[];
    readonly connection: FConnection;
    readonly isReadOnly: boolean;
    readonly context: FContext;

    protected readonly _valueInitial: any;
    protected _value: any;
    private readonly indexes: FEntityIndex[];
    private readonly options: FEntityOptions;
    private isDirty: boolean = false;
    private isNew: boolean;

    constructor(connection: FConnection, namespace: FNamespace, id: (string | number)[], value: any, options: FEntityOptions, isNew: boolean, indexes: FEntityIndex[]) {
        this.namespace = namespace;
        this.rawId = id;
        this.connection = connection;
        this.context = connection.currentContext;
        this.isReadOnly = connection.currentContext.isReadOnly;
        this.options = options;
        this.isNew = isNew;
        this.indexes = indexes;

        if (this.isNew && this.isReadOnly) {
            throw Error('Internal inconsistency');
        }

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
        this._valueInitial = { ...v };
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

    async flush() {
        await this._doFlush();
    }

    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            this.context.markDirty(this, async (connection: FConnection) => {
                await this._doFlush();
            });
        }
    }

    private async _doFlush() {
        if (!this.isDirty) {
            return;
        }
        this.isDirty = false;
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
        await this.namespace.set(this.connection, value, ...this.rawId);
        if (this.isNew) {
            log.debug('created', { entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: JSON.stringify(value) });
            for (let index of this.indexes) {
                // Check index condition if applicable
                if (index.condition && !index.condition(value)) {
                    continue;
                }
                let key = index.fields.map((v) => value[v]);
                if (index.unique) {
                    if (await this.namespace.get(this.connection, '__indexes', index.name, ...key)) {
                        throw Error('Unique index constraint failed');
                    }
                    await this.namespace.set(this.connection, value, '__indexes', index.name, ...key);
                } else {
                    await this.namespace.set(this.connection, value, '__indexes', index.name, ...key, ...this.rawId);
                }
            }
        } else {
            log.debug('updated', { entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: JSON.stringify(value) });
            for (let index of this.indexes) {
                let key = index.fields.map((v) => value[v]);
                let oldkey = index.fields.map((v) => this._valueInitial[v]);
                var needToDeleteOld = false;
                var needToCreateNew = false;
                var needToUpdateNew = false;

                // Check index condition if applicable
                if (index.condition) {
                    let newCond = index.condition(value);
                    let oldCond = index.condition(this._valueInitial);
                    if (newCond !== oldCond) {
                        if (newCond) {
                            needToCreateNew = true;
                        } else {
                            needToDeleteOld = true;
                        }
                    } else if (newCond) {
                        if (key.join('===') !== oldkey.join('===')) {
                            needToCreateNew = true;
                            needToDeleteOld = true;
                        } else {
                            needToUpdateNew = true;
                        }
                    }
                } else {
                    if (key.join('===') !== oldkey.join('===')) {
                        needToCreateNew = true;
                        needToDeleteOld = true;
                    } else {
                        needToUpdateNew = true;
                    }
                }

                if (index.unique) {
                    if (needToDeleteOld) {
                        await this.namespace.delete(this.connection, '__indexes', index.name, ...oldkey);
                    }
                    if (needToCreateNew) {
                        if (await this.namespace.get(this.connection, '__indexes', index.name, ...key)) {
                            throw Error('Unique index constraint failed');
                        }
                    }
                    if (needToCreateNew || needToUpdateNew) {
                        await this.namespace.set(this.connection, value, '__indexes', index.name, ...key);
                    }
                } else {
                    if (needToDeleteOld) {
                        await this.namespace.delete(this.connection, '__indexes', index.name, ...oldkey, ...this.rawId);
                    }
                    if (needToCreateNew) {
                        await this.namespace.set(this.connection, value, '__indexes', index.name, ...key, ...this.rawId);
                    }
                    if (needToCreateNew || needToUpdateNew) {
                        await this.namespace.set(this.connection, value, '__indexes', index.name, ...key, ...this.rawId);
                    }
                }
            }
        }
    }
}