import { DB } from '../tables';
import * as sequelize from 'sequelize';
import { IncludeOptions, Transaction } from 'sequelize';
import { delay, forever } from '../utils/timer';
import { tryLock } from './locking';
import * as ES from 'elasticsearch';

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

export async function writeReaderOffset(tx: sequelize.Transaction, key: string, offset: { offset: string, secondary: number }) {
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
        await res.save({ transaction: tx, logging: false });
    } else {
        await DB.ReaderState.create({
            key: key,
            currentOffset: offset.offset,
            currentOffsetSecondary: offset.secondary
        }, { transaction: tx, logging: false });
    }
}

export class UpdateReader<TInstance, TAttributes> {
    private name: string;
    private model: sequelize.Model<TInstance, TAttributes>;
    private processorFunc?: (data: TInstance[], tx: Transaction) => Promise<void>;
    private includeVal: Array<IncludeOptions> = [];
    private initFunc?: (tx: Transaction) => Promise<boolean>;
    private elasticClient?: ES.Client;
    private elasticIndex?: string;
    private elasticType?: string;

    constructor(name: string, model: sequelize.Model<TInstance, TAttributes>) {
        this.name = name;
        this.model = model;
    }

    processor(processor: (data: TInstance[], tx: Transaction) => Promise<void>) {
        this.processorFunc = processor;
        return this;
    }

    indexer(processor: (item: TInstance) => { id: string | number, doc: any }) {
        if (!this.elasticClient) {
            throw new Error('Elastic is not configured');
        }
        this.processorFunc = async (data) => {
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
                    body: forIndexing
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

    start() {
        if (!this.processorFunc) {
            throw Error('Processor should be set!');
        }
        updateReader(this.name, this.model, this.includeVal, this.processorFunc!!, this.initFunc);
    }
}

async function updateReader<TInstance, TAttributes>(
    name: string,
    model: sequelize.Model<TInstance, TAttributes>,
    include: Array<IncludeOptions> = [],
    processor: (data: TInstance[], tx: Transaction) => Promise<void>,
    initFunc?: (tx: Transaction) => Promise<boolean>) {

    let shouldInit = true;
    await forever(async () => {
        let res = await DB.connection.transaction({ logging: false as any }, async (tx) => {

            //
            // Prerequisites
            //

            if (!(await tryLock(tx, 'reader_' + name))) {
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
                limit: 100,
                transaction: tx,
                include: include,
                logging: false
            }));
            if (data.length <= 0) {
                return false;
            }

            console.warn(`[${name}] Importing ${data.length} elements`);

            //
            // Processing
            //

            let processed = processor(data, tx);
            let commit = writeReaderOffset(tx, name, {
                offset: (data[data.length - 1] as any).updatedAt as string,
                secondary: (data[data.length - 1] as any).id
            });
            await commit;
            await processed;

            console.warn(`[${name}] Completed ${data.length} elements`);

            return true;
        });
        if (res) {
            await delay(100);
        } else {
            await delay(1000);
        }
    });
}