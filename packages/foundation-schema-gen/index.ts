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

export function field(name: string, type: 'number' | 'string' | 'boolean') {
    currentEntity!!.addField(name, type);
}

export function primaryKey(name: string, type: 'number' | 'string') {
    currentEntity!!.addKey(name, type);
}