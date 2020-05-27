import { Schema } from './Schema';
import { schema } from './SchemaBuilder';

export type NumberField = {
    type: 'number',
    dbType: 'Int8' | 'Int16' | 'Int32' | 'Int64' | 'UInt8' | 'UInt16' | 'UInt32' | 'UInt64' | 'Float32' | 'Float64',
};
export type BooleanField = {
    type: 'boolean',
    dbType: 'UInt8',
};
export type StringField = {
    type: 'string',
    dbType: 'String',
};
export type DateField = {
    type: 'date',
    dbType: 'Date' | 'DateTime',
};

export type StructField<TStruct> = {
    type: 'struct';
    fields: SimpleFieldInfo[];
};

export type SimpleField = (NumberField | BooleanField | StringField | DateField) & { nullable?: boolean };
export type Field = SimpleField | StructField<any>;
export type NullableField<T extends SimpleField> = T & {
    nullable: true
};

type FieldTypeInternal<TField extends Field> =
    TField extends StringField ? string :
        TField extends NumberField ? number :
            TField extends BooleanField ? boolean :
                TField extends DateField ? number :
                    TField extends StructField<infer T> ? T : never;

export type FieldType<TField extends Field> = TField extends NullableField<infer T> ? FieldTypeInternal<T> | null : FieldTypeInternal<TField>;

export type SimpleFieldInfo = { name: string, field: SimpleField };
export type StructFieldInfo = { name: string, field: StructField<any> };

export type SchemaShape = { [key: string]: Field };
export type ShapeToSchema<T extends SchemaShape> = { [TKey in keyof T]: FieldType<T[TKey]> };
export type TypeFromSchema<TSchema extends Schema<any>> = TSchema extends Schema<infer T> ? T : never;

export function string(): StringField {
    return {
        type: 'string',
        dbType: 'String'
    };
}

export function integer(dbType: NumberField['dbType'] = 'Int64'): NumberField {
    return {
        type: 'number',
        dbType: dbType
    };
}

export function boolean(): BooleanField {
    return {
        type: 'boolean',
        dbType: 'UInt8'
    };
}

export function date(dbType: DateField['dbType'] = 'DateTime'): DateField {
    return {
        type: 'date',
        dbType: dbType
    };
}

export function nullable<TField extends SimpleField>(field: TField): NullableField<TField> {
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
        fields: s.fields,
    };
}
