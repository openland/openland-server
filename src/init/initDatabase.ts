import * as fs from 'fs';
import * as cp from 'child_process';
import * as db from '../connector';
import { redisClient } from '../modules/redis/redis';

export async function initDatabase(isTest: boolean, drop: boolean) {
    if ((isTest && drop) || (process.env.RECREATE_DB === 'true' && process.env.NODE_ENV === 'development')) {
        // Dropping Database
        await db.connection.getQueryInterface().dropAllTables();
        await db.connection.getQueryInterface().dropAllSchemas();

        // Dropping Redis
        if (redisClient()) {
            await redisClient()!!.flushall();
        }
    }
    if (process.env.NODE_ENV === 'development') {
        if (!isTest) { console.info('Connecting to database in DEVELOPMENT mode'); }

        if (process.env.RECREATE_DB === 'true') {
            // TODO: Dropping elastic search

            if (fs.existsSync('./dumps/dump.sql')) {
                console.warn('Recreating database');
                // cp.execSync('psql -q -h localhost -U kor_ka -d postgres -f ./dumps/dump.sql', { stdio: 'inherit' });
                cp.execSync('psql -q -h localhost -U ' + process.env.DATABASE_USER + ' -d postgres -f ./dumps/dump.sql', { stdio: 'inherit' });
                console.warn('Database imported');
            } else {
                throw new Error('Unable to find ./dumps/dump.sql');
            }

            // Resetting locks and readers
            await db.connection.query('TRUNCATE TABLE locks;', { logging: !isTest });
            await db.connection.query('TRUNCATE TABLE reader_states;', { logging: !isTest });
        }
    } else {
        if (!isTest) { console.info('Connecting to database in RELEASE mode'); }
    }
    await db.migrate();
}