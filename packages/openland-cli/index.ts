// tslint:disable:no-floating-promises
// tslint:disable:no-console
// Register Modules

require('module-alias/register');

import yargs from 'yargs';
import { createNamedContext } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { loadAllModules } from 'openland-modules/loadAllModules';
import { inTx } from '@openland/foundationdb';
import TestDataFactory from '../openland-server-tests/TestDataFactory';
import { Shutdown } from '../openland-utils/Shutdown';
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
                    await testDataFactory.createTestChats(ctx, args.chats || 1, userIds);
                }
            });

            await Shutdown.shutdown();
            process.exit();
        },
    )
    .demandCommand()
    .help()
    .wrap(72)
    .argv;