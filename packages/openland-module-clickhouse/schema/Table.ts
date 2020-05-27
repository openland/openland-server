import { Schema } from './Schema';
import { ColumnDefinition, DatabaseClient } from '../ClickHouseClient';
import { Context } from '@openland/context';
import { schema } from './SchemaBuilder';
import { SimpleField, SimpleFieldInfo, string, TypeFromSchema } from './SchemaTypes';
import { createLogger } from '@openland/log';

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

type TableEngineConfig =  {
    partition: string;
    orderBy: string;
    id: string;
};

let log = createLogger('clickhouse-table');
export class Table<T> {
    #schema: Schema<T>;
    #client: DatabaseClient;
    #tableName: string;
    #engineConfig: TableEngineConfig;

    constructor(client: DatabaseClient, tableName: string, tableSchema: Schema<T>, config: TableEngineConfig) {
        this.#schema = tableSchema;
        this.#tableName = tableName;
        this.#client = client;
        this.#engineConfig = config;
    }

    public async init(ctx: Context) {
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
            dbFields = describeSchema.mapArrayFromDb(await this.#client.query(ctx, `DESCRIBE debug.${this.#tableName}`));
        } catch (e) {
            if (e.code === 60) {
                this.createTable(ctx);
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
            if (fieldDescriptor.dbType !== field.type) {
                throw new Error(`Initiating table ${this.#tableName} failed: invalid type of '${field.name}'. Probably you should create migration`);
            }
        }
    }

    public async createTable(ctx: Context) {
        log.log(ctx, `Creating table: ${this.#tableName}`);
        let columns = this.#schema.fields.map(a => ({ name: a.name, type: (a.field.nullable ? `Nullable(${a.field.dbType})` : a.field.dbType) as ColumnDefinition['type'] }));
        await this.#client.createTable(ctx, this.#tableName, columns, this.#engineConfig.partition, this.#engineConfig.orderBy, this.#engineConfig.id);
    }

    public async insert(ctx: Context, val: T) {
        // TODO
    }
}