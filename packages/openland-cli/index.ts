// tslint:disable:no-floating-promises
// tslint:disable:no-console
// Register Modules
require('module-alias/register');
import { openDatabase } from './utils/openDatabase';
import yargs from 'yargs';
import { diagnose, calculateCount } from 'openland-cli/diagnose';

yargs
    .command('list', 'List available entities', {}, async () => {
        let res = await openDatabase();
        for (let ent of res.allEntities) {
            console.log(ent.name);
        }
    })
    .command('diag [name]', 'Run diagnostics for entity', (y) => y.positional('name', { describe: 'Name of the entity', type: 'string' }), async (args) => {
        if (!args.name) {
            throw Error('Please, provide entity');
        }
        let res = await openDatabase();
        let entity = res.allEntities.find((v) => v.name === args.name);
        if (!entity) {
            throw Error('unable to find entity');
        }
        diagnose(entity);
    })
    .command('count [name]', 'Count records', (y) => y.positional('name', { describe: 'Name of the entity', type: 'string' }), async (args) => {
        if (!args.name) {
            throw Error('Please, provide entity');
        }
        let res = await openDatabase();
        let entity = res.allEntities.find((v) => v.name === args.name);
        if (!entity) {
            throw Error('unable to find entity');
        }
        calculateCount(entity);
    })
    .demandCommand()
    .help()
    .wrap(72)
    .argv;