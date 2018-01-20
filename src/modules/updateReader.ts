import { DB } from '../tables';
import * as sequelize from 'sequelize';
import { IncludeOptions, Transaction } from 'sequelize';
import { delay, forever } from '../utils/timer';
import { tryLock } from './locking';

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

export async function updateReader<TInstance, TAttributes>(name: string,
    model: sequelize.Model<TInstance, TAttributes>,
    include: Array<IncludeOptions> = [],
    processor: (data: TInstance[], tx: Transaction) => Promise<void>) {
    await forever(async () => {
        let res = await DB.connection.transaction({ logging: false as any }, async (tx) => {

            //
            // Prerequisites
            //

            if (!(await tryLock(tx, 'reader_' + name))) {
                return false;
            }

            let offset = await readReaderOffset(tx, name);

            //
            // Data Loading
            //

            // console.warn(offset);

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
                } : {}),
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