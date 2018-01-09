import { DB } from '../tables';
import * as sequelize from 'sequelize';

export async function readReaderOffset(tx: sequelize.Transaction, key: string): Promise<Date | null> {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx
    });
    if (res != null) {
        if (res.currentOffset) {
            return new Date(res.currentOffset);
        } else {
            return null;
        }
    } else {
        return null;
    }
}

export async function writeReaderOffset(tx: sequelize.Transaction, key: string, offset: Date) {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx
    });
    if (res != null) {
        res.currentOffset = offset.toUTCString();
        await res.save({transaction: tx});
    } else {
        await DB.ReaderState.create({
            key: key,
            currentOffset: offset.toUTCString()
        }, {transaction: tx});
    }
}