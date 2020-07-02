import { Table } from './Table';
import { Schema } from './schema';

class TableSpaceImpl {
    #tableMap: Map<string, Table<any>> = new Map<string, Table<any>>();
    #locked: boolean = false;

    add<TSchema>(t: Table<TSchema>): TableSpaceImpl {
        if (this.#locked) {
            throw new Error('TableSpace is locked');
        }
        if (this.#tableMap.has(t.name)) {
            throw new Error(`Table with the name '${t.name}' already added`);
        }
        this.#tableMap.set(t.name, t);
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

    lock() {
        this.#locked = true;
    }
}

export const TableSpace = new TableSpaceImpl();

export const table = <T>(name: string, schema: Schema<T>, config: Table<any>['engineConfig']) => {
    const t = new Table(name, schema, config);
    TableSpace.add(t);
    return t;
};