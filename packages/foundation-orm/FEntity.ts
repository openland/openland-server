import { FNamespace } from './FNamespace';
import { FConnection } from './FConnection';
import { FEntityIndex } from './FEntityIndex';
import { createLogger } from 'openland-log/createLogger';
import { FDirectory } from './FDirectory';
import { Context } from 'openland-utils/Context';
import { FTransactionContext } from './utils/contexts';
import { tracer } from './utils/tracer';
import { FTransaction } from './FTransaction';
import { getTransaction } from './getTransaction';
import { FSubspace } from './FSubspace';
import { FTuple } from './FTuple';

export interface FEntityOptions {
    enableVersioning: boolean;
    enableTimestamps: boolean;
    hasLiveStreams: boolean;
    validator: (value: any) => void;
}

const log = createLogger('FEntity', false);

export abstract class FEntity {
    abstract readonly entityName: string;
    readonly obsoleteKeySpace: FSubspace<FTuple[], any>;
    readonly keySpace: FSubspace;
    readonly directory: FDirectory;
    readonly rawId: (string | number)[];
    readonly connection: FConnection;
    readonly isReadOnly: boolean;
    readonly ctx: Context;
    readonly transaction: FTransaction;

    protected _valueInitial: any;
    protected _value: any;
    private readonly _entityName: string;
    private readonly indexes: FEntityIndex[];
    private readonly options: FEntityOptions;
    private isDirty: boolean = false;
    private isNew: boolean;

    constructor(ctx: Context, connection: FConnection, namespace: FNamespace, directory: FDirectory, id: (string | number)[], value: any, options: FEntityOptions, isNew: boolean, indexes: FEntityIndex[], name: string) {
        this.ctx = ctx;
        this.obsoleteKeySpace = namespace.keySpace;
        this.directory = directory;
        this.rawId = id;
        this.connection = connection;
        this.keySpace = connection.keySpace;
        this.transaction = getTransaction(ctx);
        this.isReadOnly = this.transaction.isReadOnly;
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
        if (this.transaction.isCompleted) {
            throw Error('You can\'t update entity when transaction is in completed state.');
        }
    }

    async flush(ctx: Context, opts?: { unsafe?: boolean, noWriteLock?: boolean }) {
        await this._doFlush(ctx,
            opts && opts.unsafe !== undefined ? opts!.unsafe! : false,
            opts && opts.noWriteLock !== undefined ? !opts!.noWriteLock! : true
        );
    }

    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            this.transaction.beforeCommit(async (ctx: Context) => {
                await this._doFlush(ctx, false, true);
            });
        }
    }

    private async _doFlush(parent: Context, unsafe: boolean, lock: boolean) {
        let cache = FTransactionContext.get(parent);
        if (!cache) {
            throw Error('Tried to flush object outside of transaction');
        }
        if (cache.isCompleted) {
            throw Error('Tried to flush object after transaction is completed');
        }

        let op = async (ctx: Context) => {
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

                // Update state
                this._value = {
                    ...value
                };

                if (!this.directory.isAllocated) {
                    await this.directory.awaitAllocation();
                }

                // Write to the store
                this.obsoleteKeySpace.set(ctx, this.rawId, value);
                this.directory.set(ctx, this.rawId, value);

                // Create or Update indexes
                if (this.isNew) {
                    // Notify after successful transaction
                    if (this.options.hasLiveStreams) {
                        this.transaction.afterCommit(() => {
                            this.connection.pubsub.publish('fdb-entity-created-' + this._entityName, { entity: this._entityName });
                        });
                    }

                    // log.debug(ctx, 'created', JSON.stringify({ entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: value }));
                    for (let index of this.indexes) {
                        // Check index condition if applicable
                        if (index.condition && !index.condition(value)) {
                            continue;
                        }
                        let key = index.fields.map((v) => value[v]);
                        if (index.unique) {
                            if (!unsafe) {
                                let ex = await this.obsoleteKeySpace.get(ctx, ['__indexes', index.name, ...key]);
                                if (ex) {
                                    throw Error('Unique index constraint failed for index ' + index.name + ', at ' + key.join('.') + ', got: ' + JSON.stringify(ex));
                                }
                            }
                            this.obsoleteKeySpace.set(ctx, ['__indexes', index.name, ...key], value);
                        } else {
                            this.obsoleteKeySpace.set(ctx, ['__indexes', index.name, ...key, ...this.rawId], value);
                        }
                    }
                } else {
                    // log.debug(ctx, 'updated', JSON.stringify({ entityId: [...this.namespace.namespace, ...this.rawId].join('.'), value: value }));
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
                                this.obsoleteKeySpace.delete(ctx, ['__indexes', index.name, ...oldkey]);
                            }
                            if (needToCreateNew) {
                                if (!unsafe) {
                                    if (await this.obsoleteKeySpace.get(ctx, ['__indexes', index.name, ...key])) {
                                        throw Error('Unique index constraint failed for index ' + index.name);
                                    }
                                }
                            }
                            if (needToCreateNew || needToUpdateNew) {
                                this.obsoleteKeySpace.set(ctx, ['__indexes', index.name, ...key], value);
                            }
                        } else {
                            if (needToDeleteOld) {
                                this.obsoleteKeySpace.delete(ctx, ['__indexes', index.name, ...oldkey, ...this.rawId]);
                            }
                            if (needToCreateNew) {
                                this.obsoleteKeySpace.set(ctx, ['__indexes', index.name, ...key, ...this.rawId], value);
                            }
                            if (needToCreateNew || needToUpdateNew) {
                                this.obsoleteKeySpace.set(ctx, ['__indexes', index.name, ...key, ...this.rawId], value);
                            }
                        }
                    }
                }

                this.isNew = false;
                this._valueInitial = {
                    ...value
                };
            } catch (e) {
                log.warn(ctx, 'Unable to flush entity', JSON.stringify(this._value), e);
                throw e;
            }
        };

        if (lock) {
            await tracer.trace(parent, 'Flush:' + this.entityName, async (ctx) => {
                await cache!.readWriteLock(this.entityName)
                    .runWriteOperation(ctx, async () => {
                        await op(ctx);
                    });
            });
        } else {
            await tracer.trace(parent, 'Flush:' + this.entityName, async (ctx) => {
                await op(ctx);
            });
        }
    }
}