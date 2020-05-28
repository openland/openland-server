import { Table } from './schema/Table';

class TableSpaceImpl {
    #tableMap: Map<string, Table<any>> = new Map<string, Table<any>>();

    add<TSchema>(table: Table<TSchema>): TableSpaceImpl {
        if (this.#tableMap.has(table.name)) {
            throw new Error(`Table with the name '${table.name}' already added`);
        }
        this.#tableMap.set(table.name, table);
        return this;
    }

    get<T = any>(tableName: string): Table<T> {
        if (!this.#tableMap.has(tableName)) {
            throw new Error(`Table space does not contain table with the name '${tableName}'`);
        }

        return this.#tableMap.get(tableName)!;
    }

    all(): Table<any>[] {
        return Array.from(this.#tableMap.values());
    }
}

export const TableSpace = new TableSpaceImpl();