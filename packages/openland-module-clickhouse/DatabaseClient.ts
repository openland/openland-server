import { ClickHouseClient, ColumnDefinition } from './ClickHouseClient';
import { Context, createContextNamespace } from '@openland/context';

export const ChDatabaseContext = createContextNamespace<DatabaseClient | null>('ch-database', null);
export const withChDatabase = (parent: Context, db: DatabaseClient)  => {
    return ChDatabaseContext.set(parent, db);
};

export default class DatabaseClient {
    #client: ClickHouseClient;
    #dbName: string;

    constructor(client: ClickHouseClient, db: string) {
        this.#client = client;
        this.#dbName = db;
    }

    get dbName() {
        return this.#dbName;
    }

    async createDatabase(ctx: Context) {
        await this.#client.execute(ctx, 'CREATE DATABASE IF NOT EXISTS ' + this.#dbName);
    }

    async createTable(ctx: Context, table: string, columns: ColumnDefinition[], partition: string, orderBy: string, primaryKey: string, engine: string = 'MergeTree()') {
        let op = 'CREATE TABLE IF NOT EXISTS ' + this.#dbName + '.' + table + ' (' + columns.map((v) => (`"${v.name}"` + ' ' + v.type)).join(', ') + ')' + ` ENGINE = ${engine} PARTITION BY ` + partition + ' ORDER BY ' + orderBy + ' PRIMARY KEY ' + primaryKey;
        await this.#client.execute(ctx, op);
    }

    async insert(ctx: Context, table: string, columns: string[], data: any[][]) {
        let op = 'INSERT INTO ' + this.#dbName + '.' + table + '';
        await this.#client.insert(ctx, op, columns, data);
    }

    async count(ctx: Context, table: string, where?: string) {
        let op = 'SELECT count() FROM ' + this.#dbName + '.' + table;
        if (where) {
            op += ' WHERE ' + where;
        }
        return await this.#client.count(ctx, op);
    }

    async dropTable(ctx: Context, table: string) {
        await this.#client.execute(ctx, 'DROP TABLE IF EXISTS ' + this.#dbName + '.' + table);
    }

    async query(ctx: Context, body: string) {
        // logger.log(ctx, 'Executing: ' + body);
        return (await this.#client.client.querying(body)).data as any[];
    }
}