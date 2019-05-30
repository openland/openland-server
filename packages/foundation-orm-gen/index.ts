import { SchemaModel, EntityModel, AtomicModel } from './Model';
import { json, JsonSchema } from '../openland-utils/jsonSchema';

let currentSchema: SchemaModel | null = null;
let currentEntity: EntityModel | null = null;
let currentAtomic: AtomicModel | null = null;

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
    if (currentSchema!.atomics.find((v) => v.name === name)) {
        throw Error('Duplicate entity with name ' + name);
    }
    currentSchema!.addEntity(currentEntity!!);
    schema();
    currentEntity = null;
}

export function atomic(name: string, schema: () => void) {
    currentAtomic = new AtomicModel(name);
    if (currentSchema!.entities.find((v) => v.name === name)) {
        throw Error('Duplicate atomic with name ' + name);
    }
    if (currentSchema!.atomics.find((v) => v.name === name)) {
        throw Error('Duplicate atomic with name ' + name);
    }
    currentSchema!.addAtomic(currentAtomic!!);
    schema();
    currentAtomic = null;
}

export function field(name: string, type: 'number' | 'string' | 'boolean' | 'json') {
    return currentEntity!!.addField(name, type, [], null);
}

export function jsonField(name: string, schema: JsonSchema | (() => void)) {
    let jsonSchema: JsonSchema;

    if (schema instanceof Function) {
        jsonSchema = json(schema);
    } else {
        jsonSchema = schema;
    }

    return currentEntity!!.addField(name, 'json', [], jsonSchema);
}

export function enumField(name: string, values: string[]) {
    return currentEntity!!.addField(name, 'enum', values, null);
}

export function primaryKey(name: string, type: 'number' | 'string') {
    if (currentEntity) {
        currentEntity!!.addKey(name, type);
    } else {
        currentAtomic!!.addKey(name, type);
    }
}

export function uniqueIndex(name: string, fields: string[]) {
    return currentEntity!!.addIndex(name, fields, true);
}

export function rangeIndex(name: string, fields: string[]) {
    return currentEntity!!.addIndex(name, fields, false);
}

export function allowAdminEdit() {
    currentEntity!!.editable = true;
}

export function enableTimestamps() {
    currentEntity!!.enableTimestamps = true;
}

export function enableVersioning() {
    currentEntity!!.enableVersioning = true;
}