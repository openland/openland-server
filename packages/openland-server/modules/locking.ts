import * as Crypto from 'crypto';
import * as sequelize from 'sequelize';
import { DB, DB_SILENT } from '../tables';

let lockSeed = Crypto.randomBytes(32).toString('hex');

export async function tryLock(tx: sequelize.Transaction, key: string, version: number = 0): Promise<boolean> {
    let existing = await DB.Lock.findOne({
        where: {
            key: key
        },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        logging: DB_SILENT
    });
    let now = new Date();
    let currentTimeout = new Date(now.getTime() + 10 * 1000);
    if (existing !== null) {
        // If current version is less than current required minimum
        if (existing.minVersion!! > version) {
            return false;
        }
        let timeout = new Date(existing.timeout!!);
        if (existing.seed === lockSeed || timeout.getTime() < now.getTime()) {
            existing.seed = lockSeed;
            existing.timeout = currentTimeout.toUTCString();
            existing.version = version;
            existing.minVersion = version;
            await existing.save({ transaction: tx, logging: DB_SILENT });
            return true;
        } else {
            // Bump minumum version if needed
            if (version > existing.minVersion!!) {
                existing.minVersion = version;
                await existing.save({ transaction: tx, logging: DB_SILENT });
            }
            return false;
        }
    } else {
        await DB.Lock.create({
            key: key,
            version: version,
            minVersion: version,
            seed: lockSeed,
            timeout: currentTimeout.toUTCString()
        }, { transaction: tx, logging: DB_SILENT });
        return true;
    }
}