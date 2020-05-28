import { ClickHouseClient, ColumnDefinition } from './ClickHouseClient';
import { Context } from '@openland/context';
import { TableSpace } from './TableSpace';
import { TableClient } from './TableClient';

export class DatabaseClient {
    #client: ClickHouseClient;
    #dbName: string;
    #tables = TableSpace;

    constructor(client: ClickHouseClient, db: string) {
        this.#client = client;
        this.#dbName = db;
    }

    get tables(): TableClient<any>[] {
        return this.#tables.all().map(a => new TableClient(this, this.#tables.get(a.name)));
    }

    get<T = any>(tableName: string): TableClient<T> {
        return new TableClient<T>(this, this.#tables.get(tableName));
    }

    async createDatabase(ctx: Context) {
        await this.#client.execute(ctx, 'CREATE DATABASE IF NOT EXISTS ' + this.#dbName);
    }

    async createTable(ctx: Context, table: string, columns: ColumnDefinition[], partition: string, orderBy: string, primaryKey: string) {
        let op = 'CREATE TABLE IF NOT EXISTS ' + this.#dbName + '.' + table + ' (' + columns.map((v) => (v.name + ' ' + v.type)).join(', ') + ')' + ' ENGINE = MergeTree() PARTITION BY ' + partition + ' ORDER BY ' + orderBy + ' PRIMARY KEY ' + primaryKey;
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