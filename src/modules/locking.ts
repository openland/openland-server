import * as Crypto from 'crypto';
import * as sequelize from 'sequelize';
import { DB } from '../tables';

let lockSeed = Crypto.randomBytes(32).toString('hex');

export async function tryLock(tx: sequelize.Transaction, key: string): Promise<boolean> {
    let existing = await DB.Lock.findOne({
        where: {
            key: key
        },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        logging: false
    });
    let now = new Date();
    let currentTimeout = new Date(now.getTime() + 10 * 1000);
    if (existing != null) {
        let timeout = new Date(existing.timeout!!);
        if (existing.seed === lockSeed || timeout.getTime() < now.getTime()) {
            existing.seed = lockSeed;
            existing.timeout = currentTimeout.toUTCString();
            await existing.save({ transaction: tx, logging: false });
            return true;
        } else {
            return false;
        }
    } else {
        await DB.Lock.create({
            key: key,
            seed: lockSeed,
            timeout: currentTimeout.toUTCString()
        }, { transaction: tx, logging: false });
        return true;
    }
}