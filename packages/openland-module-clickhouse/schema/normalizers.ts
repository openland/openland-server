import {
    SimpleField, BooleanField, StringField, NumberField, DateField, NullableField, FieldType, Field,
} from './SchemaTypes';

type DbTypeFromFieldInternal<TField extends Field> =
    TField extends StringField ? string :
        TField extends NumberField ? number :
            TField extends BooleanField ? number :
                TField extends DateField ? number : never;

type DbTypeFromField<TField extends SimpleField> = TField extends NullableField<infer T> ?  DbTypeFromFieldInternal<T> | null : DbTypeFromFieldInternal<TField>;

export type ToDbFieldNormalizer<T extends SimpleField> = (value: FieldType<T>) => DbTypeFromField<T>;
export type FromDbFieldNormalizer<T extends SimpleField> = (value: DbTypeFromField<T>) => FieldType<T>;

type ToDbFieldNormalizers<T extends SimpleField> = T extends SimpleField ? { [TKey in T['dbType']]: ToDbFieldNormalizer<T> } : never;
type FromDbFieldNormalizers<T extends SimpleField> = T extends SimpleField ? { [TKey in T['type']]: FromDbFieldNormalizer<T> } : never;

export const toDbNormalizers: ToDbFieldNormalizers<SimpleField> = {
    Date: (value) => Math.round(value / 1000),
    DateTime: (value) => Math.round(value / 1000),
    Float32: value => value,
    Float64: value => value,
    Int16: value => value,
    Int32: value => value,
    Int64: value => value,
    Int8:  value => value,
    String: value => value,
    UInt16: value => value,
    UInt32: value => value,
    UInt64: value => value,
    UInt8: (value: boolean | number) => {
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        } else {
            return value;
        }
    }
};

export const fromDbNormalizers: FromDbFieldNormalizers<SimpleField> = {
    boolean: (value) => value === 1,
    date: (value) => value * 1000,
    number: value => value,
    string: value => value
};