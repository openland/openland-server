
export class EntityField {
    readonly name: string;
    readonly type: 'string' | 'number' | 'boolean' | 'enum' | 'json';
    readonly enumValues: string[];
    isNullable: boolean = false;

    constructor(name: string, type: 'string' | 'number' | 'boolean' | 'enum' | 'json', enumValues: string[]) {
        this.name = name;
        this.type = type;
        this.enumValues = enumValues;
    }

    nullable() {
        this.isNullable = true;
        return this;
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

    addField(name: string, type: 'string' | 'number' | 'boolean' | 'enum' | 'json', enumValues: string[]) {
        let res = new EntityField(name, type, enumValues);
        this.fields.push(res);
        return res;
    }

    addKey(name: string, type: 'string' | 'number' | 'boolean') {
        this.keys.push(new EntityField(name, type, []));
    }
}

export class SchemaModel {
    entities: EntityModel[] = [];
    addEntity(entity: EntityModel) {
        this.entities.push(entity);
    }
}