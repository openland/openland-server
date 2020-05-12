import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
const ClickHouse = require('@apla/clickhouse');
import { URL } from 'url';

const logger = createLogger('clickhouse-client');

export type ColumnDefinition = {
    name: string;
    type: 'Date' | 'DateTime' | 'Int8' | 'Int16' | 'Int32' | 'Int64' | 'UInt8' | 'UInt16' | 'UInt32' | 'UInt64' | 'Float32' | 'Float64' | 'String'
};

export class ClickHouseClient {
    private client: any;

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

    async insert(ctx: Context, body: string, columns: string[], data: any[][]) {
        logger.log(ctx, 'Inserting: ' + body);
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
        logger.log(ctx, 'Count: ' + body);
        let res = await this.client.querying(body);
        return parseInt(res.data[0][0], 10);
    }

    withDatabase(db: string) {
        return {
            createDatabase: async (ctx: Context) => {
                await this.execute(ctx, 'CREATE DATABASE IF NOT EXISTS ' + db);
            },
            createTable: async (ctx: Context, table: string, columns: ColumnDefinition[], partition: string, orderBy: string, primaryKey: string) => {
                let op = 'CREATE TABLE IF NOT EXISTS ' + db + '.' + table +
                    ' (' + columns.map((v) => (v.name + ' ' + v.type)).join(', ') + ')' +
                    ' ENGINE = MergeTree() PARTITION BY ' + partition + ' ORDER BY ' + orderBy + ' PRIMARY KEY ' + primaryKey;
                await this.execute(ctx, op);
            },
            insert: async (ctx: Context, table: string, columns: string[], data: any[][]) => {
                let op = 'INSERT INTO ' + db + '.' + table + '';
                await this.insert(ctx, op, columns, data);
            },
            count: async (ctx: Context, table: string, where?: string) => {
                let op = 'SELECT count() FROM ' + db + '.' + table;
                if (where) {
                    op += ' WHERE ' + where;
                }
                return await this.count(ctx, op);
            },
            dropTable: async (ctx: Context, table: string) => {
                await this.execute(ctx, 'DROP TABLE IF EXISTS ' + db + '.' + table);
            }
        };
    }
}

export type DatabaseClient = ReturnType<ClickHouseClient['withDatabase']>;