import { DB, DB_SILENT } from '../tables';
import sequelize from 'sequelize';
import { IncludeOptions, Transaction } from 'sequelize';
import { delay, forever, currentTime, printElapsed, delayBreakable } from '../utils/timer';
import * as ES from 'elasticsearch';
import { Pubsub } from './pubsub';
import { addAfterChangedCommitHook } from '../utils/sequelizeHooks';
import { LockRepository } from 'openland-module-sync/LockRepository';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { withLogContext } from 'openland-log/withLogContext';

let pubsub = new Pubsub<{ key: string, offset: string, secondary: number }>();

export async function resetReaderOffset(tx: sequelize.Transaction, key: string) {
    await DB.ReaderState.destroy({
        where: {
            key: key
        },
        transaction: tx,
        logging: DB_SILENT
    });
}

export async function readReaderOffset(tx: sequelize.Transaction, key: string, version: number): Promise<{ offset: Date, secondary: number } | null> {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx,
        logging: DB_SILENT
    });
    if (res != null) {
        if (res.version!! > version) {
            throw new Error('New version found! Abort.');
        }
        // Reader was upgraded
        if (res.version!! < version) {
            return null;
        }
        if (res.currentOffset) {
            if (res.currentOffsetSecondary) {
                return { offset: res.currentOffset, secondary: res.currentOffsetSecondary };
            } else {
                return { offset: res.currentOffset, secondary: 0 };
            }
        } else {
            return null;
        }
    } else {
        return null;
    }
}

export async function writeReaderOffset(tx: sequelize.Transaction, key: string, offset: { offset: Date, secondary: number }, remaining: number, version: number) {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx,
        logging: DB_SILENT
    });
    if (res != null) {
        res.currentOffset = offset.offset;
        res.currentOffsetSecondary = offset.secondary;
        res.remaining = remaining;
        res.version = version;
        if (res.version!! > version) {
            throw new Error('New version found! Abort.');
        }
        await res.save({ transaction: tx, logging: DB_SILENT });
        (tx as any).afterCommit(() => {
            // tslint:disable-next-line:no-floating-promises
            pubsub.publish('reader_' + key, { key, offset: offset.offset.toUTCString(), secondary: offset.secondary });
        });
    } else {
        await DB.ReaderState.create({
            key: key,
            currentOffset: offset.offset,
            currentOffsetSecondary: offset.secondary,
            remaining: remaining,
            version: version,
        }, { transaction: tx, logging: DB_SILENT });
        (tx as any).afterCommit(() => {
            // tslint:disable-next-line:no-floating-promises
            pubsub.publish('reader_' + key, { key, offset: offset.offset.toUTCString(), secondary: offset.secondary });
        });
    }
}

export class UpdateReader<TInstance, TAttributes> {
    private name: string;
    private version: number;
    private model: sequelize.Model<TInstance, TAttributes>;
    private processorFunc?: (data: TInstance[], tx?: Transaction, outOfOrder?: boolean) => Promise<void>;
    private includeVal: Array<IncludeOptions> = [];
    private initFunc?: (tx: Transaction) => Promise<boolean>;
    private elasticClient?: ES.Client;
    private elasticIndex?: string;
    private elasticType?: string;
    private isAutoOutOfOrderEnabled = false;
    private delay: number = 1000;

    constructor(name: string, version: number, model: sequelize.Model<TInstance, TAttributes>) {
        this.name = name;
        this.version = version;
        this.model = model;
        // this.isParanoid = (model as any).options.paranoid;

        //
        // Adding hook for notifications to redis
        //

        addAfterChangedCommitHook(model, (record: TInstance) => {
            // tslint:disable-next-line:no-floating-promises
            pubsub.publish('invalidate_' + this.name, {
                key: 'reader_' + this.name,
                offset: (record as any).updatedAt as string,
                secondary: (record as any).id as number
            });
        });
    }

    enalbeAutoOutOfOrder() {
        if (this.isAutoOutOfOrderEnabled) {
            return;
        }
        this.isAutoOutOfOrderEnabled = true;
        addAfterChangedCommitHook(this.model, (record: TInstance) => {
            console.warn('Doing out of order');
            return this.outOfOrder((record as any).id);
        });
    }

    processor(processor: (data: TInstance[], tx?: Transaction) => Promise<void>) {
        this.processorFunc = processor;
        return this;
    }

    indexer(processor: (item: TInstance) => Promise<{ id: string | number, doc: any } | null>) {
        if (!this.elasticClient) {
            throw new Error('Elastic is not configured');
        }
        this.processorFunc = async (data, tx, outOfOrder) => {
            let forIndexing = [];
            for (let p of data) {
                let converted = await processor(p);

                if (converted == null) {
                    continue;
                }

                forIndexing.push({
                    index: {
                        _index: this.elasticIndex,
                        _type: this.elasticType,
                        _id: converted.id
                    }
                });
                forIndexing.push(converted.doc);
            }
            if (forIndexing.length === 0) {
                return;
            }
            try {
                let res = await this.elasticClient!!.bulk({
                    body: forIndexing,
                    refresh: outOfOrder ? true : false
                });
                if (res.errors) {
                    console.warn(JSON.stringify(res));
                    throw new Error('Error during indexing');
                }
            } catch (e) {
                console.warn(e);
                throw e;
            }
        };
        return this;
    }

    onUpdate(processor: (item: TInstance) => any) {
        this.processorFunc = async (data, tx, outOfOrder) => {
            for (let p of data) {
                await processor(p);
            }
        };

        return this;
    }

    setDelay(value: number) {
        this.delay = value;
        return this;
    }

    configure(initFunc: (tx: Transaction) => Promise<boolean>) {
        this.initFunc = initFunc;
        return this;
    }

    include(include: Array<IncludeOptions>) {
        this.includeVal = include;
        return this;
    }

    elastic(elastic: ES.Client, index: string, type: string, properties?: any) {
        this.elasticClient = elastic;
        this.elasticIndex = index;
        this.elasticType = type;
        this.initFunc = async () => {
            let wasReset = false;
            while (true) {
                if (await elastic.indices.exists({ index: index }) !== true) {
                    await elastic.indices.create({ index: index });
                    wasReset = true;
                }
                if (properties) {
                    try {
                        await elastic.indices.putMapping({
                            index: index, type: type, body: {
                                properties: properties
                            }
                        });
                        return wasReset;
                    } catch (e) {
                        console.warn(e);
                        if (e.body && e.body.error && e.body.error.type && e.body.error.type === 'illegal_argument_exception') {
                            await elastic.indices.delete({ index: index });
                        } else {
                            throw e;
                        }
                    }
                } else {
                    return wasReset;
                }
            }
        };
        return this;
    }

    async outOfOrder(id: number, tx?: Transaction) {
        if (!this.processorFunc) {
            throw new Error('Processor should be set!');
        }
        let inst = await this.model.findById(id, { transaction: tx, include: this.includeVal });
        if (inst) {
            await this.processorFunc!!([inst], tx, true);
        }
    }

    start() {
        if (!this.processorFunc) {
            throw new Error('Processor should be set!');
        }

        // tslint:disable-next-line:no-floating-promises
        updateReader(this.name, this.version, this.model, this.includeVal, this.delay, (data, tx) => this.processorFunc!!(data, tx, false), this.initFunc);
    }
}

async function updateReader<TInstance, TAttributes>(
    name: string,
    version: number,
    model: sequelize.Model<TInstance, TAttributes>,
    include: Array<IncludeOptions> = [],
    delayValue: number,
    processor: (data: TInstance[], tx: Transaction) => Promise<void>,
    initFunc?: (tx: Transaction) => Promise<boolean>) {

    let isParanoid = (model as any).options.paranoid as boolean;
    let modelName = (model as any).options.name.singular;
    let lastOffset: Date | null = null;
    let lastSecondary: number | null = null;
    let waiter: (() => void) | null = null;
    // tslint:disable-next-line:no-floating-promises
    pubsub.subscribe('invalidate_' + name, (data) => {
        if (waiter) {
            if (lastOffset !== null && lastSecondary !== null) {
                let lastTime = new Date(lastOffset).getTime();
                let dataTime = new Date(data.offset).getTime();
                let changed = dataTime > lastTime || (dataTime === lastTime && lastSecondary > data.secondary);
                if (changed) {
                    waiter();
                }
            }
        }
    });
    let shouldInit = true;

    await forever(async () => {
        let res = await DB.connection.transaction({ logging: DB_SILENT as any }, async (tx) => {
            await withLogDisabled(async () => {
                await withLogContext('reader', async () => {
                    let start = currentTime();

                    //
                    // Prerequisites
                    //

                    if (!(await LockRepository.tryLock('reader_' + name, version))) {
                        shouldInit = true;
                        return false;
                    }

                    // start = printElapsed(`[${name}]Locked`, start);

                    //
                    // Invoke Init
                    //

                    if (shouldInit) {
                        if (initFunc) {
                            if (await initFunc(tx)) {
                                console.warn('Reset offset ' + name);
                                await resetReaderOffset(tx, name);
                            }
                        }
                        shouldInit = false;
                    }

                    let offset = await readReaderOffset(tx, name, version);

                    // start = printElapsed(`[${name}]Started`, start);
                    //
                    // Data Loading
                    //

                    let data: TInstance[];
                    let dateCol: string = '"' + modelName + '"."updatedAt"';
                    // let columns = ['updatedAt', 'createdAt'];

                    //
                    // WARNING
                    // Do not change order of arguments in GREATEST since it is not gonna work otherwise
                    //

                    if (isParanoid) {
                        dateCol = `GREATEST("${modelName}"."updatedAt", "${modelName}"."createdAt", "${modelName}"."deletedAt")`;
                        // columns = ['updatedAt', 'createdAt', 'deletedAt'];
                    } else {
                        dateCol = `GREATEST("${modelName}"."updatedAt", "${modelName}"."createdAt")`;
                    }
                    // let dateCol = `GREATEST(${columns.map((v) => '"' + modelName + '"."' + v + '"').join()})`;
                    let where = (offset
                        ? sequelize.literal(`(${dateCol} >= '${offset.offset.toISOString()}') AND ((${dateCol} > '${offset.offset.toISOString()}') OR("${modelName}"."id" > ${offset.secondary}))`) as any
                        : {});
                    data = (await model.findAll({
                        where: where,
                        order: [[sequelize.literal(dateCol) as any, 'ASC'], ['id', 'ASC']],
                        limit: 1000,
                        transaction: tx,
                        include: include,
                        logging: DB_SILENT,
                        paranoid: false
                    }));
                    // start = printElapsed(`[${name}]Checked`, start);
                    if (data.length <= 0) {
                        // start = printElapsed(`[${name}] Checked`, start);
                        if (offset) {
                            lastOffset = offset.offset;
                            lastSecondary = offset.secondary;
                        } else {
                            lastOffset = null;
                            lastSecondary = null;
                        }
                        return false;
                    }
                    let remaining = Math.max((await model.count({
                        where: where,
                        transaction: tx,
                        logging: DB_SILENT
                    })) - 1000, 0);

                    start = printElapsed(`[${name}]Prepared`, start);

                    console.warn(`[${name}]Importing ${data.length} elements`);

                    //
                    // Processing
                    //

                    let processed = processor(data, tx);
                    let commit = writeReaderOffset(tx, name, {
                        offset: ((data[data.length - 1] as any).deletedAt || (data[data.length - 1] as any).updatedAt) as Date,
                        secondary: (data[data.length - 1] as any).id
                    }, remaining, version);
                    await commit;
                    await processed;

                    start = printElapsed(`[${name}]Completed ${data.length} elements, remaining ${remaining} `, start);

                    return true;
                });
            });
        });
        if (res) {
            await delay(100);
        } else {
            let b = delayBreakable(delayValue);
            waiter = b.resolver;
            await b.promise;
            waiter = null;
        }
    });
}
