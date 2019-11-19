export class TypeSchema {
    public models: TypeModel[] = [];
}

export class TypeModel {
    readonly name: string;
    readonly fields: FieldModel[] = [];

    constructor(name: string) {
        this.name = name;
    }
}

export class FieldModel {
    readonly name: string;
    readonly type: Type;

    constructor(name: string, type: Type) {
        this.name = name;
        this.type = type;
    }
}

export abstract class Type { }
export class IntegerType extends Type { }
export class FloatType extends Type { }
export class BooleanType extends Type { }
export class StringType extends Type { }
export class AnyStructType extends Type { }
export class StructType extends Type {
    constructor(readonly fields: { [key: string]: Type }) {
        super();
    }
}
export class UnionType extends Type {
    constructor(readonly fields: { [key: string]: StructType }) {
        super();
    }
}
export class ArrayType extends Type {
    constructor(readonly  inner: Type) {
        super();
    }
}
export class OptionalType extends Type {
    constructor(readonly  inner: Type) {
        super();
    }
}

export function integer() {
    return new IntegerType();
}

export function float() {
    return new FloatType();
}

export function boolean() {
    return new BooleanType();
}

export function string() {
    return new StringType();
}

export function anyStruct() {
    return new AnyStructType();
}

export function struct(fields: { [key: string]: Type }) {
    return new StructType(fields);
}

export function union(fields: { [key: string]: StructType }) {
    return new UnionType(fields);
}

export function array(inner: Type) {
    return new ArrayType(inner);
}

export function optional(inner: Type) {
    return new OptionalType(inner);
}

let currentSchema: TypeSchema | null = null;
let currentType: TypeModel | null = null;

export function declareSchema(schema: () => void) {
    currentSchema = new TypeSchema();
    schema();
    let res = currentSchema!;
    currentSchema = null;
    return res;
}

export function model(name: string, schema: () => void) {
    currentType = new TypeModel(name);
    schema();
    currentSchema!.models.push(currentType!);
    currentType = null;
}

export function field(name: string, type: Type) {
    if (!currentType) {
        throw new Error('No type was declared');
    }
    currentType!.fields.push(new FieldModel(name, type));
}