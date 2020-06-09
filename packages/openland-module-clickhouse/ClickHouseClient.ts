import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
const ClickHouse = require('@apla/clickhouse');
import { URL } from 'url';
import DatabaseClient from './DatabaseClient';

// @ts-ignore
const logger = createLogger('clickhouse-client');

export type ColumnDefinition = {
    name: string;
    type: 'Date' | 'DateTime' | 'Int8' | 'Int16' | 'Int32' | 'Int64' | 'UInt8' | 'UInt16' | 'UInt32' | 'UInt64' | 'Float32' | 'Float64' | 'String' |
    'Nullable(Date)' | 'Nullable(DateTime)' | 'Nullable(Int8)' | 'Nullable(Int16)' | 'Nullable(Int32)' | 'Nullable(Int64)' | 'Nullable(UInt8)' |
        'Nullable(UInt16)' | 'Nullable(UInt32)' | 'Nullable(UInt64)' | 'Nullable(Float32)' | 'Nullable(Float64)' | 'Nullable(String)';
};

export class ClickHouseClient {
    public client: any;

    constructor(endpoint: string, username: string, password: string) {
        let url = new URL('ch://' + endpoint);
        this.client = new ClickHouse({ host: url.hostname, port: url.port, user: username, password: password });
    }

    async ping(ctx: Context) {
        await this.client.pinging();
    }

    async query(ctx: Context, body: string) {
        // logger.log(ctx, 'Executing: ' + body);
        return (await this.client.querying(body)).data as any[];
    }

    async execute(ctx: Context, body: string) {
        // logger.log(ctx, 'Executing: ' + body);
        await this.client.querying(body);
    }

    async insert(ctx: Context, body: string, columns: string[], data: any[][]) {
        // logger.log(ctx, 'Inserting: ' + body);
        await new Promise((resolve, reject) => {
            const writableStream = this.client.query(body, { format: 'JSONEachRow' }, (err: any) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
            for (let d of data) {
                let r: any = {};
                for (let i = 0; i < columns.length; i++) {
                    r[columns[i]] = d[i];
                }
                writableStream.write(r);
            }
            writableStream.end();
        });
    }

    async count(ctx: Context, body: string) {
        // logger.log(ctx, 'Count: ' + body);
        let res = await this.client.querying(body);
        return parseInt(res.data[0][0], 10);
    }

    withDatabase(db: string) {
        return new DatabaseClient(this, db);
    }
}