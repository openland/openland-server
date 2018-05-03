import { DB } from '../tables';
import * as sequelize from 'sequelize';
import { IncludeOptions, Transaction } from 'sequelize';
import { delay, forever, currentTime, printElapsed, delayBreakable } from '../utils/timer';
import { tryLock } from './locking';
import * as ES from 'elasticsearch';
import { Pubsub } from './pubsub';
import { addAfterChangedCommitHook } from '../utils/sequelizeHooks';

let pubsub = new Pubsub<{ key: string, offset: string, secondary: number }>();

export async function resetReaderOffset(tx: sequelize.Transaction, key: string) {
    await DB.ReaderState.destroy({
        where: {
            key: key
        },
        transaction: tx,
        logging: false
    });
}

export async function readReaderOffset(tx: sequelize.Transaction, key: string): Promise<{ offset: string, secondary: number } | null> {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx,
        logging: false
    });
    if (res != null) {
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

export async function writeReaderOffset(tx: sequelize.Transaction, key: string, offset: { offset: string, secondary: number }, remaining: number) {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx,
        logging: false
    });
    if (res != null) {
        res.currentOffset = offset.offset;
        res.currentOffsetSecondary = offset.secondary;
        res.remaining = remaining;
        await res.save({ transaction: tx, logging: false });
        (tx as any).afterCommit(() => {
            pubsub.publish('reader_' + key, { key, offset: offset.offset, secondary: offset.secondary });
        });
    } else {
        await DB.ReaderState.create({
            key: key,
            currentOffset: offset.offset,
            currentOffsetSecondary: offset.secondary,
            remaining: remaining
        }, { transaction: tx, logging: false });
        (tx as any).afterCommit(() => {
            pubsub.publish('reader_' + key, { key, offset: offset.offset, secondary: offset.secondary });
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

    constructor(name: string, version: number, model: sequelize.Model<TInstance, TAttributes>) {
        this.name = name;
        this.version = version;
        this.model = model;

        //
        // Adding hook for notifications to redis
        //

        addAfterChangedCommitHook(model, (record: TInstance) => {
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

    indexer(processor: (item: TInstance) => { id: string | number, doc: any }) {
        if (!this.elasticClient) {
            throw new Error('Elastic is not configured');
        }
        this.processorFunc = async (data, tx, outOfOrder) => {
            let forIndexing = [];
            for (let p of data) {
                let converted = processor(p);
                forIndexing.push({
                    index: {
                        _index: this.elasticIndex,
                        _type: this.elasticType,
                        _id: converted.id
                    }
                });
                forIndexing.push(converted.doc);
            }
            try {
                let res = await this.elasticClient!!.bulk({
                    body: forIndexing,
                    refresh: outOfOrder ? true : false
                });
                if (res.errors) {
                    console.warn(JSON.stringify(res));
                    throw Error('Error during indexing');
                }
            } catch (e) {
                console.warn(e);
                throw e;
            }
        };
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
            throw Error('Processor should be set!');
        }
        let inst = await this.model.findById(id, { transaction: tx, include: this.includeVal });
        if (inst) {
            await this.processorFunc!!([inst], tx, true);
        }
    }

    start() {
        if (!this.processorFunc) {
            throw Error('Processor should be set!');
        }

        updateReader(this.name, this.version, this.model, this.includeVal, (data, tx) => this.processorFunc!!(data, tx, false), this.initFunc);
    }
}

async function updateReader<TInstance, TAttributes>(
    name: string,
    version: number,
    model: sequelize.Model<TInstance, TAttributes>,
    include: Array<IncludeOptions> = [],
    processor: (data: TInstance[], tx: Transaction) => Promise<void>,
    initFunc?: (tx: Transaction) => Promise<boolean>) {
    let lastOffset: string | null = null;
    let lastSecondary: number | null = null;
    let waiter: (() => void) | null = null;
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
        let res = await DB.connection.transaction({ logging: false as any }, async (tx) => {

            let start = currentTime();

            //
            // Prerequisites
            //

            if (!(await tryLock(tx, 'reader_' + name, version))) {
                shouldInit = true;
                return false;
            }

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

            let offset = await readReaderOffset(tx, name);

            //
            // Data Loading
            //

            let data: TInstance[] = (await model.findAll({
                where: (offset ? {
                    $and: [
                        {
                            updatedAt: { $gte: offset.offset }
                        },
                        {
                            $or: {
                                updatedAt: { $gt: offset.offset },
                                id: { $gt: offset.secondary }
                            }
                        }
                    ]
                } as any : {}),
                order: [['updatedAt', 'ASC'], ['id', 'ASC']],
                limit: 1000,
                transaction: tx,
                include: include,
                logging: false
            }));
            let remaining = Math.max((await model.count({
                where: (offset ? {
                    $and: [
                        {
                            updatedAt: { $gte: offset.offset }
                        },
                        {
                            $or: {
                                updatedAt: { $gt: offset.offset },
                                id: { $gt: offset.secondary }
                            }
                        }
                    ]
                } as any : {}),
                transaction: tx,
                logging: false
            })) - 1000, 0);
            if (data.length <= 0) {
                if (offset) {
                    lastOffset = offset.offset;
                    lastSecondary = offset.secondary;
                } else {
                    lastOffset = null;
                    lastSecondary = null;
                }
                return false;
            }

            start = printElapsed(`[${name}] Prepared`, start);

            console.warn(`[${name}] Importing ${data.length} elements`);

            //
            // Processing
            //

            let processed = processor(data, tx);
            let commit = writeReaderOffset(tx, name, {
                offset: (data[data.length - 1] as any).updatedAt as string,
                secondary: (data[data.length - 1] as any).id
            }, remaining);
            await commit;
            await processed;

            start = printElapsed(`[${name}] Completed ${data.length} elements, remaining ${remaining}`, start);

            return true;
        });
        if (res) {
            await delay(100);
        } else {
            let b = delayBreakable(1000);
            waiter = b.resolver;
            await b.promise;
            waiter = null;
        }
    });
}