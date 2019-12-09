// tslint:disable:no-floating-promises
// tslint:disable:no-console
// Register Modules

import { Shutdown } from '../openland-utils/Shutdown';

require('module-alias/register');

import yargs from 'yargs';
import { createNamedContext } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { loadAllModules } from 'openland-modules/loadAllModules';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { uuid } from 'openland-utils/uuid';
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
                .option('addToChats', { alias: '-a', type: 'boolean', describe: 'Is set if super admin should be added to chats' });
            },
        async (args) => {
            let parent = createNamedContext('console');
            await loadAllModules(parent);

            let uid = 0;
            if (args.email) {
                let user = await Store.User.email.find(parent, args.email);
                if (!user) {
                    throw new Error('Email invalid');
                }
                uid = user.id;
            }

            await inTx(parent, async ctx => {
                let testUsers = [];
                let testUsersCount = args.chats ? (args.users || 1) : 0;
                for (let i = 1; i <= testUsersCount; i++) {
                    let testUser = await Modules.Users.createUser(ctx, `user-${uuid()}`, `test${uuid()}@maildu.de`);
                    await Modules.Users.createUserProfile(ctx, testUser.id, {
                        firstName: 'Test', lastName: `${i}`, primaryOrganization: `Test ${i}`,
                    });
                    await Modules.Users.activateUser(ctx, testUser.id, false, testUser.id);
                    await Modules.Orgs.createOrganization(ctx, testUser.id, { name: `Test organization ${i}` });
                    testUsers.push(testUser);
                }

                if (args.chats) {
                    let testCommunity = await Modules.Orgs.createOrganization(ctx, testUsers[0].id, { name: 'Test community' });

                    for (let i = 1; i <= args.chats; i++) {
                        let userIds = testUsers.map(a => a.id);
                        if (args.addToChats && uid > 0) {
                            userIds.push(uid);
                        }
                        await Modules.Messaging.room.createRoom(ctx, 'public', testCommunity.id, testUsers[0].id, userIds, {
                            title: `Test group ${i}`,
                        });
                    }
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