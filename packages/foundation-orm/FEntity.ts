import { FNamespace } from './FNamespace';
import { FContext } from './FContext';
import { FConnection } from './FConnection';
import { FEntityIndex } from './FEntityIndex';
import { createLogger } from 'openland-log/createLogger';
import { FDirectory } from './FDirectory';
import { Context, createEmptyContext } from 'openland-utils/Context';
import { resolveContext } from './utils/contexts';

export interface FEntityOptions {
    enableVersioning: boolean;
    enableTimestamps: boolean;
    hasLiveStreams: boolean;
    validator: (value: any) => void;
}

const log = createLogger('FEntity');

export abstract class FEntity {
    abstract readonly entityName: string;
    readonly namespace: FNamespace;
    readonly directory: FDirectory;
    readonly rawId: (string | number)[];
    readonly connection: FConnection;
    readonly isReadOnly: boolean;
    readonly ctx: Context;
    readonly context: FContext;

    protected _valueInitial: any;
    protected _value: any;
    private readonly _entityName: string;
    private readonly indexes: FEntityIndex[];
    private readonly options: FEntityOptions;
    private isDirty: boolean = false;
    private isNew: boolean;

    constructor(ctx: Context, connection: FConnection, namespace: FNamespace, directory: FDirectory, id: (string | number)[], value: any, options: FEntityOptions, isNew: boolean, indexes: FEntityIndex[], name: string) {
        this.ctx = ctx;
        this.namespace = namespace;
        this.directory = directory;
        this.rawId = id;
        this.connection = connection;
        this.context = resolveContext(ctx);
        this.isReadOnly = this.context.isReadOnly;
        this.options = options;
        this.isNew = isNew;
        this.indexes = indexes;
        this._entityName = name;

        if (this.isNew && this.isReadOnly) {
            throw Error('Unable to create new entity outside transaction!');
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
        try {
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

            // Validate
            this.options.validator(value);

            if (!this.directory.isAllocated) {
                await this.directory.awaitAllocation();
            }

            // Write to the store
            this.namespace.set(this.ctx, this.connection, this.rawId, value);
            this.directory.set(this.ctx, this.rawId, value);

            // Create or Update indexes
            if (this.isNew) {
                // Notify after successful transaction
                if (this.options.hasLiveStreams) {
                    this.context.afterTransaction(() => {
                        this.connection.pubsub.publish('fdb-entity-created-' + this._entityName, { entity: this._entityName });
                    });
                }

                log.debug(createEmptyContext(), 'created', JSON.stringify({ entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: value }));
                for (let index of this.indexes) {
                    // Check index condition if applicable
                    if (index.condition && !index.condition(value)) {
                        continue;
                    }
                    let key = index.fields.map((v) => value[v]);
                    if (index.unique) {
                        let ex = await this.namespace.get(this.ctx, this.connection, ['__indexes', index.name, ...key]);
                        if (ex) {
                            throw Error('Unique index constraint failed for index ' + index.name + ', at ' + key.join('.') + ', got: ' + JSON.stringify(ex));
                        }
                        this.namespace.set(this.ctx, this.connection, ['__indexes', index.name, ...key], value);
                    } else {
                        this.namespace.set(this.ctx, this.connection, ['__indexes', index.name, ...key, ...this.rawId], value);
                    }
                }
            } else {
                log.debug(createEmptyContext(), 'updated', JSON.stringify({ entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: value }));
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
                            this.namespace.delete(this.ctx, this.connection, ['__indexes', index.name, ...oldkey]);
                        }
                        if (needToCreateNew) {
                            if (await this.namespace.get(this.ctx, this.connection, ['__indexes', index.name, ...key])) {
                                throw Error('Unique index constraint failed for index ' + index.name);
                            }
                        }
                        if (needToCreateNew || needToUpdateNew) {
                            this.namespace.set(this.ctx, this.connection, ['__indexes', index.name, ...key], value);
                        }
                    } else {
                        if (needToDeleteOld) {
                            this.namespace.delete(this.ctx, this.connection, ['__indexes', index.name, ...oldkey, ...this.rawId]);
                        }
                        if (needToCreateNew) {
                            this.namespace.set(this.ctx, this.connection, ['__indexes', index.name, ...key, ...this.rawId], value);
                        }
                        if (needToCreateNew || needToUpdateNew) {
                            this.namespace.set(this.ctx, this.connection, ['__indexes', index.name, ...key, ...this.rawId], value);
                        }
                    }
                }
            }
            this.isNew = false;
            this._valueInitial = {
                ...value
            };
            this._value = {
                ...value
            };
        } catch (e) {
            log.warn(createEmptyContext(), 'Unable to flush entity', JSON.stringify(this._value), e);
            throw e;
        }
    }
}