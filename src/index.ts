import * as db from './connector';
import * as server from './server';
import * as cluster from 'cluster';
import * as fs from 'fs';
import * as cp from 'child_process';
import { enableIndexer } from './indexing';

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
                if (fs.existsSync('./dumps/dump.sql')) {
                    console.warn('Recreating database');
                    cp.execSync('psql -q -h localhost -U steve -d postgres -f ./dumps/dump.sql', { stdio: 'inherit' });
                    console.warn('Database imported');
                } else {
                    throw Error('Unable to find ./dumps/dump.sql');
                }
            }
        } else {
            console.info('Connecting to database in RELEASE mode');
        }
        await db.migrate();
        initWorker();
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

async function initWorker() {
    server.default();
    if (process.env.ELASTIC_ENDPOINT && process.env.ELASTIC_ENABLE_INDEXING !== 'false') {
        enableIndexer();
    }
}