import { Schema } from './Schema';

type TableEngineConfig =  {
    partition: string;
    orderBy: string;
    id: string;
};

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
        return 'MergeTree';
    }
    get engineConfig() {
        return this.#engineConfig;
    }
}

export const table = <T>(name: string, schema: Schema<T>, id: string, partition: string, orderBy: string) => {
    return new Table<T>(name, schema, { id, partition, orderBy });
};