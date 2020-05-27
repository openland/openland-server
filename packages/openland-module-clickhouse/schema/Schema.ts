import { SimpleField, SimpleFieldInfo } from './SchemaTypes';
import { FromDbFieldNormalizer, fromDbNormalizers, ToDbFieldNormalizer, toDbNormalizers } from './normalizers';

type DbType = string | number | null;

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

const get = <TReturn = any>(obj: any, path: string): TReturn | undefined => {
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

export class Schema<T> {
    #fields: SimpleFieldInfo[];

    constructor(fields: SimpleFieldInfo[]) {
        this.#fields = fields;
    }

    mapToDb(obj: T): DbType[] {
        let values: DbType[] = [];
        for (let field of this.#fields) {
            let path = field.name;

            let normalize = get<ToDbFieldNormalizer<SimpleField>>(toDbNormalizers, field.field.dbType)!;
            let fieldData = get(obj, path);
            if (!field.field.nullable && (fieldData === undefined || fieldData === null)) {
                throw new Error(`${path} shouldn't be null`);
            } else if (fieldData === undefined || fieldData === null) {
                values.push(null);
            } else {
                values.push(normalize(fieldData));
            }
        }
        return values;
    }

    mapFromDb(fields: DbType[]): T {
        let value: any = {};
        for (let i = 0; i < this.#fields.length; ++i) {
            let path = this.#fields[i].name;
            let normalize = get<FromDbFieldNormalizer<SimpleField>>(fromDbNormalizers, this.#fields[i].field.type)!;
            let fieldValue = fields[i];
            if (fieldValue === null) {
                set(value, path, null);
            } else {
                set(value, path, normalize(fieldValue));
            }
        }
        return value;
    }

    mapArrayToDb(objs: T[]): DbType[][] {
        return objs.map(a => this.mapToDb(a));
    }

    mapArrayFromDb(objs: DbType[][]): T[] {
        return objs.map(a => this.mapFromDb(a));
    }

    get fields() {
        return this.#fields;
    }
}