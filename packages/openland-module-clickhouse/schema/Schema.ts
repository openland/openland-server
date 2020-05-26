import { FieldInfo, SimpleFieldType } from './SchemaTypes';

const set = (obj: any, path: string, value: any) => {
    let keys = path.split('.');
    let current = obj;
    for (let key of keys.slice(0, -1)) {
        if (current[key] === null || current[key] === undefined) {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
};

const get = (obj: any, path: string) => {
    let keys = path.split('.');
    let current = obj;
    for (let key of keys.slice(0, -1)) {
        if (current[key] !== null && current[key] !== undefined) {
            current = current[key];
        } else {
            return undefined;
        }
    }
    return current[keys[keys.length - 1]];
};

type DatabaseFields = SimpleFieldType[];

export class Schema<T> {
    #fields: FieldInfo[];

    constructor(fields: FieldInfo[]) {
        this.#fields = fields;
    }

    mapToDb(obj: T): DatabaseFields {
        let values: DatabaseFields = [];
        for (let field of this.#fields) {
            let path = field.name.replace(/_/g, '.');
            values.push(get(obj, path));
        }
        return values;
    }

    mapFromDb(fields: DatabaseFields): T {
        let value: any = {};
        for (let i = 0; i < this.#fields.length; ++i) {
            let path = this.#fields[i].name.replace(/_/g, '.');
            set(value, path, fields[i]);
        }
        return value;
    }

    fields = () => {
        return this.#fields;
    }
}