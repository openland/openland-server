import {
    Field, FieldInfo, FieldTypeWithNullable, SchemaShape, ShapeToSchema, StructField,
} from './SchemaTypes';
import { Schema } from './Schema';

export class SchemaBuilder<T> {
    #fields: FieldInfo[];

    constructor(fields: FieldInfo[] = []) {
        this.#fields = fields;
    }

    public field<TName extends string, TField extends Field>(
        name: TName,
        field: TField,
    ): SchemaBuilder<T & { [_ in TName]: FieldTypeWithNullable<TField> }> {
        this.validateFieldName(name);

        if (field.type !== 'struct') {
            this.#fields.push({ name, type: field.type, nullable: field.nullable || false });
        } else if (field.type === 'struct') {
            let structField = field as any as StructField<any>;
            this.#fields.push(...structField.fields.map(a => ({ ...a, name: `${name}_${a.name}` })));
        }

        // @ts-ignore
        return this;
    }

    public build(): Schema<T> {
        return new Schema<T>(this.#fields);
    }

    private validateFieldName(name: string) {
        if (!this.#fields.every(a => a.name !== name)) {
            throw new Error(`Schema already contains field with given name: ${name}`);
        }
        if (name.includes('_')) {
            throw new Error('Field name should not contain underscore character');
        }
        if (name.includes('.')) {
            throw new Error('Field name should not contain dot character');
        }
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