import { Schema } from './Schema';
import { schema } from './SchemaBuilder';

export type NumberField = {
    type: 'number',
    nullable?: boolean,
};
export type BooleanField = {
    type: 'boolean',
    nullable?: boolean,
};
export type StringField = {
    type: 'string',
    nullable?: boolean,
};
export type DateField = {
    type: 'date',
    nullable?: boolean,
};

export type StructField<TStruct> = {
    type: 'struct';
    fields: FieldInfo[];
    nullable?: boolean;
};

export type Field = NumberField | BooleanField | StringField | DateField | StructField<any>;
type NullableField<T extends Field> = T & { nullable: true };

export type SimpleFieldType = 'string' | 'boolean' | 'number' | 'date';
type FieldType<TField extends Field> =
    TField extends StringField ? string :
        TField extends NumberField ? number :
            TField extends BooleanField ? boolean :
                TField extends DateField ? number :
                    TField extends StructField<infer T> ? T : never;

export type FieldTypeWithNullable<TField extends Field> = TField extends NullableField<infer T> ? FieldType<T> | null : FieldType<TField>;

export type FieldInfo = { name: string, type: SimpleFieldType, nullable: boolean };

export type SchemaShape = { [key: string]: Field };
export type ShapeToSchema<T extends SchemaShape> = { [TKey in keyof T]: FieldTypeWithNullable<T[TKey]> };

export function string(): StringField {
    return {
        type: 'string'
    };
}

export function integer(): NumberField {
    return {
        type: 'number'
    };
}

export function boolean(): BooleanField {
    return {
        type: 'boolean'
    };
}

export function date(): DateField {
    return {
        type: 'date'
    };
}

export function nullable<TField extends Field>(field: TField): NullableField<TField> {
    return {
        ...field,
        nullable: true,
    };
}

export function struct<T extends SchemaShape>(shape: T | Schema<ShapeToSchema<T>>): StructField<ShapeToSchema<T>> {
    let s: Schema<ShapeToSchema<T>>;
    if (shape instanceof Schema) {
        s = shape;
    } else {
        s = schema(shape);
    }

    return {
        type: 'struct',
        fields: s.fields(),
    };
}
