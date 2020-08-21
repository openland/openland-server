// tslint:disable:no-floating-promises
// tslint:disable:no-console
// Register Modules

require('module-alias/register');

import yargs from 'yargs';
import { openTestDatabase } from '../openland-server/foundationdb';
import { createNamedContext } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { loadAllModules } from 'openland-modules/loadAllModules';
import { encoders, inTx } from '@openland/foundationdb';
import TestDataFactory from '../openland-server-tests/TestDataFactory';
import { Shutdown } from '../openland-utils/Shutdown';
import { randomInt } from '../openland-utils/random';
// import { openDatabase } from './utils/openDatabase';
// import { diagnose, calculateCount, removeOldIndexes, diagAll, deleteInvalid } from 'openland-cli/diagnose';

yargs
    .command('list', 'List available entities', {}, async () => {
        // let res = await openDatabase();
        // for (let ent of res.allEntities) {
        //     console.log(ent.name);
        // }
    })
    .command('diag-all', 'Diagnostics of all entities', {}, async () => {
        // let res = await openDatabase();
        // await diagAll(res);
    })
    .command('diag [name]', 'Run diagnostics for entity', (y) => y.positional('name', { describe: 'Name of the entity', type: 'string' }), async (args) => {
        if (!args.name) {
            throw Error('Please, provide entity');
        }
        // let res = await openDatabase();
        // let entity = res.allEntities.find((v) => v.name === args.name);
        // if (!entity) {
        //     throw Error('unable to find entity');
        // }
        // await diagnose(entity);
    })
    .command('count [name]', 'Count records', (y) => y.positional('name', { describe: 'Name of the entity', type: 'string' }), async (args) => {
        if (!args.name) {
            throw Error('Please, provide entity');
        }
        // let res = await openDatabase();
        // let entity = res.allEntities.find((v) => v.name === args.name);
        // if (!entity) {
        //     throw Error('unable to find entity');
        // }
        // await calculateCount(entity);
    })
    .command('fix-index [name]', 'Remove old indexes', (y) => y.positional('name', { describe: 'Name of the entity', type: 'string' }), async (args) => {
        if (!args.name) {
            throw Error('Please, provide entity');
        }
        // let res = await openDatabase();
        // let entity = res.allEntities.find((v) => v.name === args.name);
        // if (!entity) {
        //     throw Error('unable to find entity');
        // }
        // await removeOldIndexes(entity);
    })
    .command('fix-invalid [name]', 'Remove old indexes', (y) => y.positional('name', { describe: 'Name of the entity', type: 'string' }), async (args) => {
        if (!args.name) {
            throw Error('Please, provide entity');
        }
        // let res = await openDatabase();
        // let entity = res.allEntities.find((v) => v.name === args.name);
        // if (!entity) {
        //     throw Error('unable to find entity');
        // }
        // await deleteInvalid(entity);
    })
    .command(
        'test-init [email]',
        'Init test server with users and organization',
            y => {
            return y
                .positional('email', { type: 'string', describe: 'Email of the primary user' })
                .option('users', { alias: 'u', type: 'number', describe: 'Count of test users and organizations' })
                .option('chats', { alias: 'c', type: 'number', describe: 'Count of test chats' })
                .option('firstName', { alias: 'fn', type: 'string', describe: 'First name of superadmin' })
                .option('lastName', { alias: 'ln', type: 'string', describe: 'Last name of superadmin' })
                .option('addToChats', { alias: 'a', type: 'boolean', describe: 'Is set if super admin should be added to chats' });
            },
        async (args) => {
            let parent = createNamedContext('console');
            await loadAllModules(parent);

            let testDataFactory = new TestDataFactory();

            let uid = 0;
            if (args.email) {
                let user = await Store.User.email.find(parent, args.email);
                if (!user) {
                    if (!args.firstName || !args.lastName) {
                        throw new Error('You should specify firstName and lastName if user is not created');
                    }
                    user = await testDataFactory.createSuperAdmin(parent, args.email, args.firstName, args.lastName);
                    console.log(`Created new super admin -> ${args.email}`);
                }
                uid = user.id;
            }

            await inTx(parent, async ctx => {
                let testUsersCount = args.chats ? (args.users || 1) : 0;
                let testUsers = await testDataFactory.createTestUsers(ctx, testUsersCount);

                if (args.chats) {
                    let userIds = testUsers.map(a => a.id);
                    if (args.addToChats && uid > 0) {
                        userIds.push(uid);
                    }
                    await testDataFactory.createTestChats(ctx, args.chats, userIds);
                }
            });

            await Shutdown.shutdown();
            process.exit();
        },
    )
    .command('benchmark-counting-directory', '', y => {
        return y;
    }, async args => {
        let parent = createNamedContext('console');

        let db = await openTestDatabase();

        let plainSubspace = db.allKeys.subspace(Buffer.from([0]))
            .withKeyEncoding(encoders.tuple);
        let blockSubspace = db.allKeys.subspace(Buffer.from([1]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json);

        // generate fake plain data
        for (let i = 0; i < 10; i++) {
            await inTx(parent, async ctx => {
                for (let j = 0; j < 1000; j++) {
                    plainSubspace.set(ctx, [i * 1000 + j], Buffer.from([]));
                }
            });
        }
        // generate fake block data
        for (let i = 0; i < 100; i++) {
            await inTx(parent, async ctx => {
                let data: number[] = [];
                for (let j = 0; j < 100; j++) {
                    data.push(i * 100 + j);
                }
                console.log(i * 100);
                blockSubspace.set(ctx, [i * 100], {
                    data
                });
            });
        }

        console.log('seed done');

        // generate random ranges
        let randomRanges: [number, number][] = [];
        for (let i = 0; i < 100; i++) {
            let first = randomInt(1, 10000);
            let second = randomInt(1, 10000);
            randomRanges.push([Math.min(first, second), Math.max(first, second)]);
            console.log([Math.min(first, second), Math.max(first, second)]);
        }

        console.log('ranges generated');

        // benchmark plain simple range
        console.time('plain-range');
        for (let [from, to] of randomRanges) {
            await inTx(parent, async (ctx) => {
                await plainSubspace.range(ctx, [], { after: [from], before: [to] });
            });
        }
        console.timeEnd('plain-range');

        // benchmark plain snapshot range
        console.time('plain-snapshot');
        for (let [from, to] of randomRanges) {
            await inTx(parent, async (ctx) => {
                await plainSubspace.snapshotRange(ctx, [], { after: [from - 1], before: [to + 1] });
            });
        }
        console.timeEnd('plain-snapshot');

        // benchmark block snapshot range
        console.time('block');
        for (let [from, to] of randomRanges) {
            await inTx(parent, async (ctx) => {
                let firstBlock = await blockSubspace.snapshotRange(ctx, [], { after: [from + 1], limit: 1, reverse: true });
                await blockSubspace.snapshotRange(ctx, [], { after: [(firstBlock[0].key[0] as number) - 1], before: [(to - to % 100) + 100 + 1] });
                // console.log(to - from + ' ' + allBlocks.reduce((b, a) => a.value.data.length + b, 0));
            });
        }
        console.timeEnd('block');

        await Shutdown.shutdown();
        process.exit();
    }
    )
    .demandCommand()
    .help()
    .wrap(72)
    .argv;