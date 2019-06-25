import { JsonSchema } from '../openland-utils/jsonSchema';

export class EntityField {
    readonly name: string;
    readonly type: 'string' | 'number' | 'boolean' | 'enum' | 'json';
    readonly enumValues: string[];
    readonly jsonSchema: JsonSchema | null;
    isNullable: boolean = false;
    isSecure: boolean = false;

    constructor(name: string, type: 'string' | 'number' | 'boolean' | 'enum' | 'json', enumValues: string[], jsonSchema: JsonSchema | null) {
        this.name = name;
        this.type = type;
        this.enumValues = enumValues;
        this.jsonSchema = jsonSchema;
    }

    secure() {
        this.isSecure = true;
        return this;
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
    dispName?: string;
    constructor(name: string, fields: string[], unique: boolean) {
        this.name = name;
        this.fields = fields;
        this.unique = unique;
    }

    withDisplayName(name: string) {
        this.dispName = name;
        return this;
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
    editable: boolean = false;

    constructor(name: string) {
        this.name = name;
    }

    addField(name: string, type: 'string' | 'number' | 'boolean' | 'enum' | 'json', enumValues: string[], jsonSchema: JsonSchema | null) {
        let res = new EntityField(name, type, enumValues, jsonSchema);
        this.fields.push(res);
        return res;
    }

    addIndex(name: string, fields: string[], unique: boolean) {
        let res = new EntityIndex(name, fields, unique);
        this.indexes.push(res);
        return res;
    }

    addKey(name: string, type: 'string' | 'number' | 'boolean') {
        let res = new EntityField(name, type, [], null);
        this.keys.push(res);
        return res;
    }
}

export class DirectoryModel {
    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

export class SchemaModel {
    entities: EntityModel[] = [];
    directories: DirectoryModel[] = [];

    addDirectory(name: string) {
        this.directories.push(new DirectoryModel(name));
    }

    addEntity(entity: EntityModel) {
        this.entities.push(entity);
    }
}