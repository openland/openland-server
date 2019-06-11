import { inTx } from './inTx';
import { FSubspace } from './FSubspace';
import { Context } from '@openland/context';
import { createLogger, withLogPath } from '@openland/log';

const logger = createLogger('operations');

export async function copySubspace(parent: Context, from: FSubspace, to: FSubspace) {
    let cursor: Buffer | undefined;
    let emptyBuffer = Buffer.of();
    let completed = false;
    let iteration = 0;
    while (!completed) {
        logger.log(parent, 'Copying subspace iteration: ' + iteration);
        await inTx(parent, async (ctx) => {
            let r = await from.range(ctx, emptyBuffer, { after: cursor, limit: 10000 });
            for (let i of r) {
                cursor = i.key;
                to.set(ctx, i.key, i.value);
            }
            if (r.length === 0) {
                completed = true;
            }
        });
        iteration++;
    }
}

export async function deleteMissing(parent: Context, from: FSubspace, to: FSubspace) {
    let cursor: Buffer | undefined;
    let emptyBuffer = Buffer.of();
    let completed = false;
    let iteration = 0;
    while (!completed) {
        logger.log(parent, 'Delete missing keys iteration: ' + iteration);
        await inTx(parent, async (ctx) => {
            let r2 = await to.range(ctx, emptyBuffer, { after: cursor, limit: 10000 });

            await Promise.all(r2.map(async (i) => {
                let ex = await from.get(ctx, i.key);
                if (!ex) {
                    to.delete(ctx, i.key);
                }
            }));
            for (let i of r2) {
                cursor = i.key;
            }
            if (r2.length === 0) {
                completed = true;
            }
        });
        iteration++;
    }
}

export async function syncSubspaces(parent: Context, from: FSubspace, to: FSubspace) {
    let iteration = 0;
    while (!await isSubspaceEquals(parent, from, to)) {
        let ctx = withLogPath(parent, 'sync');
        logger.log(ctx, 'Subspace sync iteration: ' + iteration);
        await copySubspace(ctx, from, to);
        await deleteMissing(ctx, from, to);
        iteration++;
    }
}

export async function isSubspaceEquals(parent: Context, a: FSubspace, b: FSubspace): Promise<boolean> {
    let cursor: Buffer | undefined;
    let emptyBuffer = Buffer.of();
    let completed = false;
    while (!completed) {
        let equals = await inTx(parent, async (ctx) => {
            let r = await a.range(ctx, emptyBuffer, { after: cursor, limit: 10000 });
            let r2 = await b.range(ctx, emptyBuffer, { after: cursor, limit: 10000 });
            if (r.length !== r2.length) {
                return false;
            }
            for (let i = 0; i < r.length; i++) {
                if (Buffer.compare(r[i].key, r2[i].key) !== 0) {
                    return false;
                }
                if (Buffer.compare(r[i].value, r2[i].value) !== 0) {
                    return false;
                }
            }
            for (let i of r) {
                cursor = i.key;
            }
            if (r.length === 0) {
                completed = true;
            }
            return true;
        });
        if (!equals) {
            return false;
        }
    }
    return true;
}