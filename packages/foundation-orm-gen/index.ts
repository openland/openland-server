import { SchemaModel, EntityModel } from './Model';

let currentSchema: SchemaModel | null = null;
let currentEntity: EntityModel | null = null;

export function declareSchema(schema: () => void) {
    currentSchema = new SchemaModel();
    schema();
    let res = currentSchema!;
    currentSchema = null;
    return res;
}

export function entity(name: string, schema: () => void) {
    currentEntity = new EntityModel(name);
    if (currentSchema!.entities.find((v) => v.name === name)) {
        throw Error('Duplicate entity with name ' + name);
    }
    currentSchema!.addEntity(currentEntity!!);
    schema();
    currentEntity = null;
}

export function field(name: string, type: 'number' | 'string' | 'boolean' | 'json' | 'id') {
    return currentEntity!!.addField(name, type, []);
}

export function enumField(name: string, values: string[]) {
    return currentEntity!!.addField(name, 'enum', values);
}

export function primaryKey(name: string, type: 'number' | 'string' | 'id') {
    currentEntity!!.addKey(name, type);
}

export function uniqueIndex(name: string, fields: string[]) {
    return currentEntity!!.addIndex(name, fields, true);
}

export function rangeIndex(name: string, fields: string[]) {
    return currentEntity!!.addIndex(name, fields, false);
}

export function enableTimestamps() {
    currentEntity!!.enableTimestamps = true;
}

export function enableVersioning() {
    currentEntity!!.enableVersioning = true;
}