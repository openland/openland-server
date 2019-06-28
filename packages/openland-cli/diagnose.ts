import { FEntityFactory } from 'foundation-orm/FEntityFactory';
import { FEntity } from 'foundation-orm/FEntity';
import { createNamedContext } from '@openland/context';
import { createLogger, withLogPath } from '@openland/log';

// function isOkInteger(src: number) {
//     if (!Number.isFinite(src)) {
//         return false;
//     }
//     if (!Number.isInteger(src)) {
//         return false;
//     }
//     if (!Number.isSafeInteger(src)) {
//         return false;
//     }
//     return true;
// }

export async function diagnose(entity: FEntityFactory<FEntity>) {
    let rootCtx = withLogPath(createNamedContext('diagnose'), entity.name);
    let log = createLogger('diagnostics');
    let after: any = undefined;
    log.log(rootCtx, 'Start');
    let invalid = 0;
    let offset = 0;
    while (true) {
        let ex = await entity.directory.range(rootCtx, [], { limit: 1000, after });
        if (ex.length === 0) {
            break;
        }
        for (let k of ex) {
            try {
                entity.options.keyValidator(k.key);
            } catch (e) {
                log.warn(rootCtx, 'Found invalid primary key');
                invalid++;
            }
        }
        after = ex[ex.length - 1].key;
        offset++;
        if (offset % 10 === 0) {
            log.log(rootCtx, 'Processed ' + offset + ' items');
        }
    }
    log.log(rootCtx, 'End: ' + invalid);
}

export async function calculateCount(entity: FEntityFactory<FEntity>) {
    let rootCtx = withLogPath(createNamedContext('diagnose'), entity.name);
    let log = createLogger('diagnostics');
    let after: any = undefined;
    log.log(rootCtx, 'Start');
    let count = 0;
    let offset = 0;
    while (true) {
        let ex = await entity.directory.range(rootCtx, [], { limit: 1000, after });
        if (ex.length === 0) {
            break;
        }
        count += ex.length;
        offset++;
        if (offset % 10 === 0) {
            log.log(rootCtx, 'Processed ' + offset + ' items');
        }
    }
    log.log(rootCtx, 'Total: ' + count);
}