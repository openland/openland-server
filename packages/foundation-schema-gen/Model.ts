
export class EntityField {
    readonly name: string;
    readonly type: 'string' | 'number' | 'boolean';
    constructor(name: string, type: 'string' | 'number' | 'boolean') {
        this.name = name;
        this.type = type;
    }
}

export class EntityModel {
    readonly name: string;
    keys: EntityField[] = [];
    fields: EntityField[] = [];
    enableVersioning: boolean = false;
    enableTimestamps: boolean = false;
    constructor(name: string) {
        this.name = name;
    }

    addField(name: string, type: 'string' | 'number' | 'boolean') {
        this.fields.push(new EntityField(name, type));
    }

    addKey(name: string, type: 'string' | 'number' | 'boolean') {
        this.keys.push(new EntityField(name, type));
    }
}

export class SchemaModel {
    entities: EntityModel[] = [];
    addEntity(entity: EntityModel) {
        this.entities.push(entity);
    }
}