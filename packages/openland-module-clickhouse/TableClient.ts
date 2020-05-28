import { schema, SimpleField, SimpleFieldInfo, string, TypeFromSchema } from './schema';
import { ColumnDefinition } from './ClickHouseClient';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { Table } from './schema/Table';
import { DatabaseClient } from './DatabaseClient';

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
export class TableClient<T> {
    #client: DatabaseClient;
    #table: Table<T>;

    constructor(client: DatabaseClient, table: Table<T>) {
        this.#table = table;
        this.#client = client;
    }

    get name() {
        return this.#table.name;
    }

    public async init(ctx: Context) {
        let fields = this.#table.schema.fields;
        let fieldsMap = this.#table.schema.fields
            .reduce<Map<string, SimpleField>>((acc: Map<string, SimpleField>, value: SimpleFieldInfo) => {
                    acc.set(value.name, value.field);
                    return acc;
                },
                new Map<string, SimpleField>()
            );

        let dbFields: DescribeRow[];
        try {
            dbFields = describeSchema.mapArrayFromDb(await this.#client.query(ctx, `DESCRIBE debug.${this.#table.name}`));
        } catch (e) {
            if (e.code === 60) {
                 await this.createTable(ctx);
                return;
            } else {
                throw e;
            }
        }

        if (dbFields.length !== fields.length) {
            throw new Error(`Initiating table ${this.#table.name} failed: invalid fields length. Probably you should create migration`);
        }

        for (let field of dbFields) {
            let fieldDescriptor = fieldsMap.get(field.name);
            if (!fieldDescriptor) {
                throw new Error(`Initiating table ${this.#table.name} failed: field '${field.name}' is not in schema. Probably you should create migration`);
            }
            if (fieldDescriptor.dbType !== field.type) {
                throw new Error(`Initiating table ${this.#table.name} failed: invalid type of '${field.name}'. Probably you should create migration`);
            }
        }
    }

    public async createTable(ctx: Context) {
        log.log(ctx, `Creating table: ${this.#table.name}`);
        let columns = this.#table.schema.fields.map(a => ({ name: a.name, type: (a.field.nullable ? `Nullable(${a.field.dbType})` : a.field.dbType) as ColumnDefinition['type'] }));
        await this.#client.createTable(ctx, this.#table.name, columns, this.#table.engineConfig.partition, this.#table.engineConfig.orderBy, this.#table.engineConfig.id);
    }

    public async insert(ctx: Context, vals: T[]) {
        await this.#client.insert(ctx, this.#table.name, this.#table.schema.fields.map(a => a.name), this.#table.schema.mapArrayToDb(vals));
    }
}