import {
    Field, SimpleFieldInfo, FieldType, SchemaShape, ShapeToSchema, SimpleField, StructField,
} from './SchemaTypes';
import { Schema } from './Schema';

export class SchemaBuilder<T> {
    #fields: SimpleFieldInfo[];

    private constructor(fields: SimpleFieldInfo[] = []) {
        this.#fields = fields;
    }

    public field<TName extends string, TField extends Field>(
        name: TName,
        field: TField,
    ): SchemaBuilder<T & { [_ in TName]: FieldType<TField> }> {
        this.validateFieldName(name);

        if (field.type !== 'struct') {
            this.#fields.push({ name, field: field as SimpleField });
        } else {
            let structField = field as any as StructField<any>;
            this.#fields.push(...structField.fields.map(a => ({ ...a, name: `${name}.${a.name}` })));
        }

        return this as SchemaBuilder<any>;
    }

    public build(): Schema<T> {
        return new Schema<T>(this.#fields);
    }

    private validateFieldName(name: string) {
        if (!this.#fields.every(a => a.name !== name)) {
            throw new Error(`Schema already contains field with given name: ${name}`);
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