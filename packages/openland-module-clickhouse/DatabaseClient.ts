import { ClickHouseClient, ColumnDefinition } from './ClickHouseClient';
import { Context } from '@openland/context';
import { Table } from './schema/Table';
import { TableClient } from './TableClient';

class TableSpace {
    #tableMap: Map<string, Table<any>> = new Map<string, Table<any>>();
    #db: DatabaseClient;

    constructor(parent: DatabaseClient) {
        this.#db = parent;
    }

    with<TSchema>(table: Table<TSchema>): TableSpace {
        if (this.#tableMap.has(table.name)) {
            throw new Error(`Table with the name '${table.name}' already added`);
        }
        this.#tableMap.set(table.name, table);
        return this;
    }

    get(tableName: string): TableClient<any>  {
        if (!this.#tableMap.has(tableName)) {
            throw new Error(`Table space does not contain table with the name '${tableName}'`);
        }

        return new TableClient<any>(this.#db, this.#tableMap.get(tableName)!);
    }
}

export class DatabaseClient {
    #client: ClickHouseClient;
    #dbName: string;
    #tables: TableSpace = new TableSpace(this);

    constructor(client: ClickHouseClient, db: string) {
        this.#client = client;
        this.#dbName = db;
    }

    get tables() {
        return this.#tables;
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
        await this.insert(ctx, op, columns, data);
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