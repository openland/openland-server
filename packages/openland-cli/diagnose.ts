// import { createNamedContext } from '@openland/context';
// import { createLogger, withLogPath } from '@openland/log';
// import { inTx } from '@openland/foundationdb';
// import { Store } from 'openland-module-db/store';

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

// export async function diagnose(entity: FEntityFactory<FEntity>) {
//     let rootCtx = withLogPath(createNamedContext('diagnose'), entity.name);
//     let log = createLogger('diagnostics');
//     let after: any = undefined;
//     log.log(rootCtx, 'Start');
//     let invalid = 0;
//     let offset = 0;
//     let total = 0;
//     while (true) {
//         let ex = await entity.directory.range(rootCtx, [], { limit: 1000, after });
//         if (ex.length === 0) {
//             break;
//         }
//         outer: for (let k of ex) {
//             try {
//                 entity.options.keyValidator(k.key);
//             } catch (e) {
//                 log.warn(rootCtx, 'Found invalid primary key');
//                 log.warn(rootCtx, k.key);
//                 log.warn(rootCtx, e);
//                 invalid++;
//                 continue;
//             }

//             for (let k2 of k.key) {
//                 if (typeof k2 === 'number') {
//                     if (!isOkInteger(k2)) {
//                         log.warn(rootCtx, 'Found invalid integer key');
//                         log.warn(rootCtx, k.key);
//                         invalid++;
//                         continue outer;
//                     }
//                 }
//             }

//             try {
//                 entity.options.validator(k.value);
//             } catch (e) {
//                 log.warn(rootCtx, 'Found invalid value');
//                 log.warn(rootCtx, k.value);
//                 log.warn(rootCtx, k.key);
//                 log.warn(rootCtx, e);
//                 invalid++;
//             }
//         }
//         after = ex[ex.length - 1].key;
//         offset++;
//         total += ex.length;
//         if (offset % 10 === 0) {
//             log.log(rootCtx, 'Processed ' + total + ' items');
//         }
//     }
//     log.log(rootCtx, 'Results: ' + invalid + ' invalid of ' + total);
// }

// export async function deleteInvalid(entity: FEntityFactory<FEntity>) {
//     let rootCtx = withLogPath(createNamedContext('diagnose'), entity.name);
//     let log = createLogger('diagnostics');
//     let after: any = undefined;
//     log.log(rootCtx, 'Start');
//     let invalid = 0;
//     let offset = 0;
//     let total = 0;
//     let invalidKeys: any[] = [];
//     while (true) {
//         let ex = await entity.directory.range(rootCtx, [], { limit: 1000, after });
//         if (ex.length === 0) {
//             break;
//         }
//         outer: for (let k of ex) {
//             try {
//                 entity.options.keyValidator(k.key);
//             } catch (e) {
//                 log.warn(rootCtx, 'Found invalid primary key');
//                 log.warn(rootCtx, k.key);
//                 log.warn(rootCtx, e);
//                 invalid++;
//                 invalidKeys.push(k.key);
//                 continue;
//             }

//             for (let k2 of k.key) {
//                 if (typeof k2 === 'number') {
//                     if (!isOkInteger(k2)) {
//                         log.warn(rootCtx, 'Found invalid integer key');
//                         log.warn(rootCtx, k.key);
//                         invalid++;
//                         invalidKeys.push(k.key);
//                         continue outer;
//                     }
//                 }
//             }

//             try {
//                 entity.options.validator(k.value);
//             } catch (e) {
//                 log.warn(rootCtx, 'Found invalid value');
//                 log.warn(rootCtx, k.value);
//                 log.warn(rootCtx, k.key);
//                 log.warn(rootCtx, e);
//                 invalidKeys.push(k.key);
//                 invalid++;
//             }
//         }
//         after = ex[ex.length - 1].key;
//         offset++;
//         total += ex.length;
//         if (offset % 10 === 0) {
//             log.log(rootCtx, 'Processed ' + total + ' items');
//         }
//     }
//     log.log(rootCtx, 'Deleting: ' + invalid + ' invalid of ' + total);
//     await inTx(rootCtx, async (ctx) => {
//         for (let k of invalidKeys) {
//             entity.directory.clear(ctx, k);
//         }
//     });
//     log.log(rootCtx, 'Completed: ' + invalid + ' invalid of ' + total);
// }

// export async function removeOldIndexes(entity: FEntityFactory<FEntity>) {
//     let rootCtx = withLogPath(createNamedContext('diagnose'), entity.name);
//     let log = createLogger('diagnostics');
//     log.log(rootCtx, 'Start');
//     await inTx(rootCtx, async (ctx) => {
//         entity.directory.clearPrefixed(ctx, ['__indexes']);
//     });
//     log.log(rootCtx, 'End');
// }

// export async function calculateCount(entity: FEntityFactory<FEntity>) {
//     let rootCtx = withLogPath(createNamedContext('diagnose'), entity.name);
//     let log = createLogger('diagnostics');
//     let after: any = undefined;
//     log.log(rootCtx, 'Start');
//     let count = 0;
//     let offset = 0;
//     while (true) {
//         let ex = await entity.directory.range(rootCtx, [], { limit: 1000, after });
//         if (ex.length === 0) {
//             break;
//         }
//         after = ex[ex.length - 1].key;
//         offset++;
//         count += ex.length;
//         if (offset % 10 === 0) {
//             log.log(rootCtx, 'Processed ' + count + ' items');
//         }
//     }
//     log.log(rootCtx, 'Total: ' + count);
// }

// // async function isValid(entity: FEntityFactory<FEntity>) {
// //     let rootCtx = createNamedContext(entity.name);
// //     let log = createLogger('diagnostics');
// //     let after: any = undefined;
// //     log.log(rootCtx, 'Start');
// //     let offset = 0;
// //     let total = 0;
// //     while (true) {
// //         let ex = await entity.directory.range(rootCtx, [], { limit: 1000, after });
// //         if (ex.length === 0) {
// //             break;
// //         }
// //         for (let k of ex) {
// //             try {
// //                 entity.options.keyValidator(k.key);
// //             } catch (e) {
// //                 log.warn(rootCtx, 'Found invalid primary key');
// //                 log.warn(rootCtx, k.key);
// //                 return false;
// //             }

// //             for (let k2 of k.key) {
// //                 if (typeof k2 === 'number') {
// //                     if (!isOkInteger(k2)) {
// //                         log.warn(rootCtx, 'Found invalid integer key');
// //                         log.warn(rootCtx, k.key);
// //                         return false;
// //                     }
// //                 }
// //             }

// //             try {
// //                 entity.options.validator(k.value);
// //             } catch (e) {
// //                 log.warn(rootCtx, 'Found invalid value');
// //                 log.warn(rootCtx, k.value);
// //                 log.warn(rootCtx, k.key);
// //                 return false;
// //             }
// //         }
// //         after = ex[ex.length - 1].key;
// //         offset++;
// //         total += ex.length;
// //         if (offset % 10 === 0) {
// //             log.log(rootCtx, 'Processed ' + total + ' items');
// //         }
// //     }
// //     log.log(rootCtx, 'End');
// //     return true;
// // }

// export async function diagAll(diags: Store) {
//     let rootCtx = createNamedContext('diagnose');
//     let log = createLogger('diagnostics');
//     let invalid = new Set<string>();
//     // for (let entity of diags.allEntities) {
//     //     if (!await isValid(entity)) {
//     //         invalid.add(entity.name);
//     //     }
//     // }
//     log.log(rootCtx, 'Invalid entities: ' + Array.from(invalid));
// }