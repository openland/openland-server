import {
    Field, FieldInfo, FieldType, isSimpleField, nullable, SchemaShape, ShapeToSchema, SimpleFieldInfo, string,
} from './SchemaTypes';
import { Schema } from './Schema';

function addFieldsToSchema(fields: FieldInfo[], map: Map<SimpleFieldInfo, string>, objectPath: string[], dbPath: string[], shouldBeNullable: boolean) {
    for (let next of fields) {
        if (isSimpleField(next.field)) {
            map.set({ name: [...dbPath, next.name].join('.'), field: shouldBeNullable ? nullable(next.field) : next.field }, [...objectPath, next.name].join('.'));
        }
        if (next.field.type === 'struct') {
            addFieldsToSchema(next.field.schema.fields, map, [...objectPath, next.name], [...dbPath, next.name], shouldBeNullable);
        }
        if (next.field.type === 'union') {
            map.set({ name: [...dbPath, next.name, 'type'].join('.'), field: string() }, [...objectPath, next.name, 'type'].join('.'));
            for (let [type, s] of Object.entries(next.field.schema)) {
                addFieldsToSchema(s.fields, map, [...objectPath, next.name], [...dbPath, next.name, type], true);
            }
        }
    }
    return map;
}

export class SchemaBuilder<T> {
    #fields: FieldInfo[];

    private constructor(fields: FieldInfo[] = []) {
        this.#fields = fields;
    }

    public field<TName extends string, TField extends Field>(
        name: TName,
        field: TField,
    ): SchemaBuilder<T & { [_ in TName]: FieldType<TField> }> {
        this.validateFieldName(name);
        this.#fields.push({ name, field });
        return this as SchemaBuilder<any>;
    }

    public build(): Schema<T> {
        let map = new Map<SimpleFieldInfo, string>();
        addFieldsToSchema(this.#fields, map, [], [], false);
        return new Schema<T>(map);
    }

    private validateFieldName(name: string) {
        if (!this.#fields.every(a => a.name !== name)) {
            throw new Error(`Schema already contains field with given name: ${name}`);
        }
        if (name.includes('.')) {
            throw new Error('Field name should not contain dot character');
        }
    }

    static create<T = any>(): SchemaBuilder<T> {
        return new SchemaBuilder<T>();
    }

    static fromShape<T extends SchemaShape>(shape: T): SchemaBuilder<ShapeToSchema<T>> {
        let schemaBuilder = new SchemaBuilder<ShapeToSchema<T>>();
        for (let [field, type] of Object.entries(shape)) {
            schemaBuilder.field(field, type);
        }
        return schemaBuilder;
    }
}

export function schema<T extends SchemaShape>(shape: T): Schema<ShapeToSchema<T>> {
    return SchemaBuilder.fromShape(shape).build();
}