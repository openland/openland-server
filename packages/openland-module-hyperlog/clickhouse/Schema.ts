type SimpleFieldType = 'string' | 'boolean' | 'number' | 'date';

type NumberField = {
    type: 'number',
    nullable?: boolean,
};
type BooleanField = {
    type: 'boolean',
    nullable?: boolean,
};
type StringField = {
    type: 'string',
    nullable?: boolean,
};
type DateField = {
    type: 'date',
    nullable?: boolean,
};

type StructField<TStruct> = {
    type: 'struct';
    fields: FieldInfo[];
    nullable?: boolean;
};

type Field = NumberField | BooleanField | StringField | DateField | StructField<any>;

type FieldType<TField extends Field> =
    TField extends StringField ? string :
    TField extends NumberField ? number :
    TField extends BooleanField ? boolean :
    TField extends DateField ? number :
    TField extends StructField<infer T> ? T : never;

type FieldInfo = { name: string, type: SimpleFieldType, nullable: boolean };

class SchemaBuilder<T> {
    #fields: FieldInfo[];

    constructor(fields: FieldInfo[] = []) {
        this.#fields = fields;
    }

    public field<TName extends string, TField extends Field>(
        name: TName,
        field: TField,
    ): SchemaBuilder<T & { [_ in TName]: FieldType<TField> }> {
        if (!this.#fields.every(a => a.name !== name)) {
            throw new Error(`Schema already contains field with given name: ${name}`);
        }
        if (field.type !== 'struct') {
            this.#fields.push({ name, type: field.type, nullable: field.nullable || false });
        } else if (field.type === 'struct') {
            let structField = field as any as StructField<any>;
            this.#fields.push(...structField.fields.map(a => ({ ...a, name: `${name}_${a.name}` })));
        }

        // @ts-ignore
        return this;
    }

    public getFields(): FieldInfo[] {
        return [...this.#fields];
    }
}

export function string(nullable?: boolean): StringField {
    return {
        type: 'string',
        nullable
    };
}

export function integer(nullable?: boolean): NumberField {
    return {
        type: 'number',
        nullable
    };
}

export function boolean(nullable?: boolean): BooleanField {
    return {
        type: 'boolean',
        nullable
    };
}

export function date(nullable?: boolean): DateField {
    return {
        type: 'date',
        nullable
    };
}

type MapTypesToSchema<T extends { [key: string]: Field }> = { [TKey in keyof T]: FieldType<T[TKey]> };

export function schema<T extends { [key: string]: Field }>(shape: T, nullable?: boolean): SchemaBuilder<MapTypesToSchema<T>> {
    let schemaBuilder = new SchemaBuilder<MapTypesToSchema<T>>();
    for (let [field, type] of Object.entries(shape)) {
        schemaBuilder.field(field, type);
    }
    return schemaBuilder;
}

export function struct<T extends { [key: string]: Field }>(shape: T | SchemaBuilder<MapTypesToSchema<T>>, nullable?: boolean): StructField<MapTypesToSchema<T>> {
    let builder: SchemaBuilder<MapTypesToSchema<T>>;
    if (shape instanceof SchemaBuilder) {
        builder = shape;
    } else {
        builder = schema(shape);
    }

    return {
        type: 'struct',
        fields: builder.getFields(),
        nullable: nullable,
    };
}