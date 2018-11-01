
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

export class EntityIndex {
    readonly fields: string[];
    readonly name: string;
    readonly unique: boolean;
    range: boolean = false;
    streaming: boolean = false;
    condition?: (src: any) => boolean;
    constructor(name: string, fields: string[], unique: boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
    }

    withRange() {
        this.range = true;
        return this;
    }

    withStreaming() {
        this.streaming = true;
        return this;
    }

    withCondition(handler: (src: any) => boolean) {
        this.condition = handler;
        return this;
    }
}

export class EntityModel {
    readonly name: string;
    keys: EntityField[] = [];
    fields: EntityField[] = [];
    indexes: EntityIndex[] = [];
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

    addIndex(name: string, fields: string[], unique: boolean) {
        let res = new EntityIndex(name, fields, unique);
        this.indexes.push(res);
        return res;
    }

    addKey(name: string, type: 'string' | 'number' | 'boolean') {
        let res = new EntityField(name, type, []);
        this.keys.push(res);
        return res;
    }
}

export class SchemaModel {
    entities: EntityModel[] = [];
    addEntity(entity: EntityModel) {
        this.entities.push(entity);
    }
}