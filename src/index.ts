import * as db from './connector';
import * as api from './api';
import * as sample from './sample';
import * as cluster from 'cluster';
import * as fs from 'fs';
import * as cp from 'child_process';

if (cluster.isMaster) {
    initMater();
} else {
    initWorker();
}

async function initMater() {
    try {
        if (process.env.NODE_ENV === 'development') {
            console.info('Connecting to database in DEVELOPMENT mode');
            if (process.env.RECREATE_DB === 'true') {
                await db.connection.getQueryInterface().dropAllTables();
                await db.connection.getQueryInterface().dropAllSchemas();
                if (fs.existsSync('./dumps/pgdump.bin')) {
                    try {
                        cp.execSync('pg_restore --verbose --clean --no-acl --no-owner -h localhost -U steve -d postgres ./dumps/pgdump.bin', {stdio: 'inherit'});
                    } catch (e) {
                        console.warn(e);
                    }
                    await db.migrate();
                } else {
                    await db.migrate();
                    await sample.createEmptyData();
                }
            } else {
                await db.migrate();
            }
        } else {
            console.info('Connecting to database in RELEASE mode');
            await db.migrate();
        }
        require('./imports');

        console.warn('Concurrency: ' + process.env.WEB_CONCURRENCY);
        if (process.env.WEB_CONCURRENCY) {
            for (var i = 0; i < parseInt(process.env.WEB_CONCURRENCY!!, 10); i++) {
                cluster.fork();
            }
        } else {
            initWorker();
        }
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
    }
}

async function initWorker() {
    api.default();
}

// async function init(worker?: number) {
//   try {
//     console.log(worker)
//     if (!worker) {

//     }
//     require('./imports')

//     throng(4, launchWorker)
//   } catch (e) {
//     console.error("Unable to init server")
//     console.error(e)
//   }
// }

// function launchWorker(worker: number) {
//   api.default()
// }

// init()
// function start() {
//   init()
// }

// const WORKERS = process.env.WEB_CONCURRENCY || 1;

// init()