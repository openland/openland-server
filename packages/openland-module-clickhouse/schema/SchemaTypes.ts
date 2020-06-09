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

export type StructField<T> = {
    type: 'struct';
    schema: Schema<T>;
};
export type UnionField<TUnion, T> = {
    type: 'union';
    schema: { [TKey in keyof TUnion]: Schema<TUnion[TKey]> };
};

export type SimpleField = (NumberField | BooleanField | StringField | DateField) & { nullable?: boolean };
export type Field = SimpleField | StructField<any> | UnionField<any, any>;
export type NullableField<T extends SimpleField> = T & {
    nullable: true
};

type FieldTypeInternal<TField extends Field> =
    TField extends StringField ? string :
        TField extends NumberField ? number :
            TField extends BooleanField ? boolean :
                TField extends DateField ? number :
                    TField extends StructField<infer T1> ? T1 :
                        TField extends UnionField<any, infer T2> ? T2 : never;

export type FieldType<TField extends Field> = TField extends NullableField<infer T> ? FieldTypeInternal<T> | null : FieldTypeInternal<TField>;

export type FieldInfo = { name: string, field: Field };
export type SimpleFieldInfo = { name: string, field: SimpleField };

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
        schema: s,
    };
}

export function union<T extends { [key: string]: SchemaShape }>(u: T):
    UnionField<
        { [TKey in keyof T]: ShapeToSchema<T[TKey]> },
        { [TKey in keyof T]: ShapeToSchema<T[TKey]> & { type: TKey } }[keyof T]
        > {
    let typeSchemas: any = {};
    for (let [type, shape] of Object.entries(u)) {
        typeSchemas[type] = schema(shape);
    }

    return {
        type: 'union',
        schema: typeSchemas,
    };
}

export function isSimpleField(arg: Field): arg is SimpleField {
    return arg.type === 'boolean' || arg.type === 'string' || arg.type === 'date' || arg.type === 'number';
}