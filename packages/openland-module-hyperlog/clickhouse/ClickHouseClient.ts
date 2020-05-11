import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
const ClickHouse = require('@apla/clickhouse');
import { URL } from 'url';

const logger = createLogger('clickhouse-client');

export class ClickHouseClient {
    private client: any;

    readonly op = {
        createDatabaseIfNotExists: async (ctx: Context, name: string) => {
            await this.execute(ctx, 'CREATE DATABASE IF NOT EXISTS ' + name);
        }
    };

    constructor(endpoint: string, username: string, password: string) {
        let url = new URL('ch://' + endpoint);
        this.client = new ClickHouse({ host: url.hostname, port: url.port, user: username, password: password });
    }

    async ping(ctx: Context) {
        await this.client.pinging();
    }

    async query(ctx: Context, body: string) {
        logger.log(ctx, 'Executing: ' + body);
        return (await this.client.querying(body)).data as any[];
    }

    async execute(ctx: Context, body: string) {
        logger.log(ctx, 'Executing: ' + body);
        await this.client.querying(body);
    }

    async insert(ctx: Context, body: string, data: any[][]) {
        logger.log(ctx, 'Inserting: ' + body);
        await new Promise((resolve, reject) => {
            const writableStream = this.client.query(body, (err: any) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
            for (let d of data) {
                writableStream.write(d);
            }
            writableStream.end();
        });
    }
}
