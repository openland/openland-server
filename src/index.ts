import * as db from './connector';
import { startApi } from './server';
import * as cluster from 'cluster';
import * as fs from 'fs';
import * as cp from 'child_process';
import { enableIndexer } from './indexing';
import { initWorkers } from './workers';
import { redisClient } from './modules/redis/redis';
import { checkFilesConfig } from './modules/files';

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

                // Dropping Database
                await db.connection.getQueryInterface().dropAllTables();
                await db.connection.getQueryInterface().dropAllSchemas();

                // Dropping Redis
                if (redisClient()) {
                    await redisClient()!!.flushall();
                }

                // TODO: Dropping elastic search

                if (fs.existsSync('./dumps/dump.sql')) {
                    console.warn('Recreating database');
                    // cp.execSync('psql -q -h localhost -U kor_ka -d postgres -f ./dumps/dump.sql', { stdio: 'inherit' });
                    cp.execSync('psql -q -h localhost -U ' + process.env.DATABASE_USER + ' -d postgres -f ./dumps/dump.sql', { stdio: 'inherit' });
                    console.warn('Database imported');
                } else {
                    throw Error('Unable to find ./dumps/dump.sql');
                }

                // Resetting locks and readers
                await db.connection.query('TRUNCATE TABLE locks;');
                await db.connection.query('TRUNCATE TABLE reader_states;');
            }
        } else {
            console.info('Connecting to database in RELEASE mode');
        }
        await db.migrate();
        await initWorker();
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

async function initWorker() {
    await checkFilesConfig();
    await enableIndexer();
    await initWorkers();
    await startApi();
}