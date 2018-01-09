import { DB } from '../tables';
import * as sequelize from 'sequelize';

export async function readReaderOffset(tx: sequelize.Transaction, key: string): Promise<string | null> {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx
    });
    if (res != null) {
        if (res.currentOffset) {
            return res.currentOffset;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

export async function writeReaderOffset(tx: sequelize.Transaction, key: string, offset: string) {
    let res = await DB.ReaderState.findOne({
        where: {
            key: key
        },
        transaction: tx
    });
    if (res != null) {
        res.currentOffset = offset;
        await res.save({transaction: tx});
    } else {
        await DB.ReaderState.create({
            key: key,
            currentOffset: offset
        }, {transaction: tx});
    }
}