import { Schema } from './schema/Schema';
import DatabaseClient  from './DatabaseClient';
import { Context } from '@openland/context';
import { SimpleField, SimpleFieldInfo, string, TypeFromSchema } from './schema/SchemaTypes';
import { ColumnDefinition } from './ClickHouseClient';
import { schema } from './schema/SchemaBuilder';
import { createLogger } from '@openland/log';

type TableEngineConfig = {
    engine?: string,
    partition: string;
    orderBy: string;
    primaryKey: string;
};

const describeSchema = schema({
    name: string(),
    type: string(),
    default_type: string(),
    default_expression: string(),
    comment: string(),
    codec_expression: string(),
    ttl_expression: string()
});

type DescribeRow = TypeFromSchema<typeof describeSchema>;

let log = createLogger('clickhouse-table');

export class Table<T> {
    #schema: Schema<T>;
    #tableName: string;
    #engineConfig: TableEngineConfig;

    constructor(tableName: string, tableSchema: Schema<T>, config: TableEngineConfig) {
        this.#schema = tableSchema;
        this.#tableName = tableName;
        this.#engineConfig = config;
    }

    get name() {
        return this.#tableName;
    }
    get schema() {
        return this.#schema;
    }
    get engine() {
        return this.#engineConfig.engine || 'MergeTree()';
    }
    get engineConfig() {
        return { ...this.#engineConfig, engine: this.engine };
    }

    public async init(ctx: Context, client: DatabaseClient) {
        let fields = this.#schema.fields;
        let fieldsMap = this.#schema.fields
            .reduce<Map<string, SimpleField>>((acc: Map<string, SimpleField>, value: SimpleFieldInfo) => {
                    acc.set(value.name, value.field);
                    return acc;
                },
                new Map<string, SimpleField>()
            );

        let dbFields: DescribeRow[];
        try {
            dbFields = describeSchema.mapArrayFromDb(await client.query(ctx, `DESCRIBE ${client.dbName}.${this.#tableName}`));
        } catch (e) {
            if (e.code === 60) { // table not created
                await this.createTable(ctx, client);
                return;
            } else {
                throw e;
            }
        }

        if (dbFields.length !== fields.length) {
            throw new Error(`Initiating table ${this.#tableName} failed: invalid fields length. Probably you should create migration`);
        }

        for (let field of dbFields) {
            let fieldDescriptor = fieldsMap.get(field.name);
            if (!fieldDescriptor) {
                throw new Error(`Initiating table ${this.#tableName} failed: field '${field.name}' is not in schema. Probably you should create migration`);
            }
            let dbType: string = fieldDescriptor.dbType;
            if (fieldDescriptor.nullable) {
                dbType = 'Nullable(' + fieldDescriptor.dbType + ')';
            }
            if (dbType !== field.type) {
                throw new Error(`Initiating table ${this.#tableName} failed: invalid type of '${field.name}'. Expected ${fieldDescriptor.dbType}, but got ${field.type}. Probably you should create migration`);
            }
        }
    }

    public async createTable(ctx: Context, client: DatabaseClient) {
        log.log(ctx, `Creating table: ${this.#tableName}`);
        let columns = this.#schema.fields.map(a => ({ name: a.name, type: (a.field.nullable ? `Nullable(${a.field.dbType})` : a.field.dbType) as ColumnDefinition['type'] }));
        await client.createTable(ctx, this.#tableName, columns, this.#engineConfig.partition, this.#engineConfig.orderBy, this.#engineConfig.primaryKey,  this.#engineConfig.engine);
    }

    public async insert(ctx: Context, client: DatabaseClient, vals: T[]) {
        await client.insert(ctx, this.#tableName, this.#schema.fields.map(a => a.name), this.#schema.mapArrayToDb(vals));
    }
}