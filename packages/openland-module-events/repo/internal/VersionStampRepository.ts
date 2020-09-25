import { TransactionCache, encoders, getTransaction, Database } from '@openland/foundationdb';
import { Context } from '@openland/context';

const versionstamp = new TransactionCache<number>('versionstamp-index');

export class VersionStampRepository {

    readonly db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * Allocates unique Versionstamp index value
     * 
     * @param ctx context with transaction
     */
    allocateVersionstampIndex(ctx: Context) {
        let index = (versionstamp.get(ctx, 'key') || 0) + 1;
        versionstamp.set(ctx, 'key', index);
        return encoders.int16BE.pack(index);
    }

    /**
     * Resolve Versionstamp
     * @param ctx 
     * @param index 
     */
    resolveVersionstamp(ctx: Context, index: Buffer) {
        let versionStamp = getTransaction(ctx).rawTransaction(this.db).getVersionstamp();
        return {
            promise: (async () => {
                return Buffer.concat([await versionStamp.promise, index]);
            })()
        };
    }
}