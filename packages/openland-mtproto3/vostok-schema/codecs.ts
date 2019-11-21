export const typeSymbol: unique symbol = Symbol('type');

/**
 * Codec performs type-safe serialization to json
 */
export interface Codec<T> {
    readonly [typeSymbol]: T;

    /**
     * Decode from serialized object
     * @param src encoded data
     */
    decode(src: any): T;

    /**
     * Encode for serialization
     * @param src source data
     */
    encode(src: T): any;

    /**
     * Verify and Normalize data
     * @param src source data
     */
    normalize(src: any): T;
}

export class StructCodec<T> implements Codec<T> {
    readonly [typeSymbol]!: T;

    readonly name: string;
    readonly fields: { [K in keyof T]: Codec<any> };

    constructor(name: string, fields: { [K in keyof T]: Codec<any> }) {
        this.name = name;
        this.fields = fields;
    }

    decode(src: any): T {
        if (typeof src !== 'object') {
            throw Error('Input type is not an object');
        }
        if (!src._type || src._type !== this.name) {
            throw Error('Input _type is not ' + this.name);
        }
        let res: any = {};
        for (let key in this.fields) {
            res[key] = this.fields[key].decode(src[key]);
        }
        res._type = this.name;
        return res;
    }
    encode(src: T) {
        if (typeof src !== 'object') {
            throw Error('Input type is not an object');
        }
        let res: any = {};
        for (let key in this.fields) {
            let v = this.fields[key].encode(src[key]);
            if (v !== null) {
                res[key] = v;
            }
        }
        res._type = this.name;
        return res;
    }
    normalize(src: any): T {
        if (typeof src !== 'object') {
            throw Error('Input type is not an object');
        }
        let res: any = {};
        for (let key in this.fields) {
            res[key] = this.fields[key].normalize(src[key]);
        }
        res._type = this.name;
        return res;
    }
}

export class AnyStructCodec<T> implements Codec<T> {
    readonly [typeSymbol]!: T;

    readonly knownStucts: Map<string, Codec<any>>;

    constructor(knownStucts: Map<string, Codec<any>>) {
        this.knownStucts = knownStucts;
    }

    decode(src: any): T {
        if (typeof src !== 'object') {
            throw Error('Input type is not an object');
        }
        if (!src._type || !this.knownStucts.has(src._type)) {
            throw Error('Unknown type: ' + src._type);
        }
        return this.knownStucts.get(src._type)!.decode(src);
    }
    encode(src: T) {
        if (typeof src !== 'object') {
            throw Error('Input type is not an object');
        }
        if (!(src as any)._type || !this.knownStucts.has((src as any)._type)) {
            throw Error('Unknown type: ' + (src as any)._type);
        }
        return this.knownStucts.get((src as any)._type)!.encode(src);
    }
    normalize(src: any): T {
        if (typeof src !== 'object') {
            throw Error('Input type is not an object');
        }
        if (!(src as any)._type || !this.knownStucts.has((src as any)._type)) {
            throw Error('Unknown type: ' + (src as any)._type);
        }
        return this.knownStucts.get((src as any)._type)!.normalize(src);
    }
}

export class UnionCodec<T> implements Codec<T> {
    readonly [typeSymbol]!: T;
    readonly keys: { [key: string]: StructCodec<any> };

    constructor(keys: { [key: string]: StructCodec<any> }) {
        this.keys = keys;
    }

    decode(src: any): T {
        let type = src.type as string;
        if (typeof type !== 'string') {
            throw Error('.type field is not string, got: ' + type);
        }
        let codec = this.keys[type];
        if (!codec) {
            throw Error('type ' + type + ' is not found');
        }
        return {
            type,
            ...codec.decode(src)
        };
    }

    encode(src: T) {
        let type = (src as any).type as string;
        if (typeof type !== 'string') {
            throw Error('.type field is not string, got: ' + type);
        }
        let codec = this.keys[type];
        if (!codec) {
            throw Error('type ' + type + ' is not found');
        }
        return {
            type,
            ...codec.encode(src)
        };
    }

    normalize(src: any): T {
        let type = src.type as string;
        if (typeof type !== 'string') {
            throw Error('.type field is not string, got: ' + type);
        }
        let codec = this.keys[type];
        if (!codec) {
            throw Error('type ' + type + ' is not found');
        }
        return {
            type,
            ...codec.normalize(src)
        };
    }
}

export class ArrayCodec<T> implements Codec<T[]> {
    readonly [typeSymbol]!: T[];
    readonly inner: Codec<T>;
    constructor(inner: Codec<T>) {
        this.inner = inner;
    }

    decode(src: any) {
        if (!Array.isArray(src)) {
            throw Error('Input type is not an array');
        }
        return src.map((v) => this.inner.decode(v));
    }
    encode(src: T[]) {
        if (!Array.isArray(src)) {
            throw Error('Input type is not an array');
        }
        return src.map((v) => this.inner.encode(v));
    }
    normalize(src: any) {
        if (!Array.isArray(src)) {
            throw Error('Input type is not an array');
        }
        return src.map((v) => this.inner.normalize(v));
    }
}

class StringCodec implements Codec<string> {
    readonly [typeSymbol]!: string;

    decode(src: any) {
        if (typeof src === 'string') {
            return src;
        } else {
            throw Error('Input type is not a string');
        }
    }
    encode(src: string) {
        if (typeof src === 'string') {
            return src;
        } else {
            throw Error('Input type is not a string');
        }
    }
    normalize(src: any) {
        if (typeof src === 'string') {
            return src;
        } else {
            throw Error('Input type is not a string');
        }
    }
}

class BooleanCodec implements Codec<boolean> {
    readonly [typeSymbol]!: boolean;

    decode(src: any) {
        if (typeof src === 'boolean') {
            return src;
        } else {
            throw Error('Input type is not a boolean');
        }
    }
    encode(src: boolean) {
        if (typeof src === 'boolean') {
            return src;
        } else {
            throw Error('Input type is not a boolean');
        }
    }
    normalize(src: any) {
        if (typeof src === 'boolean') {
            return src;
        } else {
            throw Error('Input type is not a string');
        }
    }
}

class NumberCodec implements Codec<number> {
    readonly [typeSymbol]!: number;

    decode(src: any) {
        if (typeof src === 'number') {
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
    encode(src: number) {
        if (typeof src === 'number') {
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
    normalize(src: any) {
        if (typeof src === 'number') {
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
}

class IntegerCodec implements Codec<number> {
    readonly [typeSymbol]!: number;

    decode(src: any) {
        if (typeof src === 'number') {
            if (!Number.isSafeInteger(src)) {
                throw Error('Number ' + src + ' is not a safe integer');
            }
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
    encode(src: number) {
        if (typeof src === 'number') {
            if (!Number.isSafeInteger(src)) {
                throw Error('Number ' + src + ' is not a safe integer');
            }
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
    normalize(src: any) {
        if (typeof src === 'number') {
            if (!Number.isSafeInteger(src)) {
                throw Error('Number ' + src + ' is not a safe integer');
            }
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
}

class FloatCodec implements Codec<number> {
    readonly [typeSymbol]!: number;

    decode(src: any) {
        if (typeof src === 'number') {
            if (!Number.isFinite(src)) {
                throw Error('Number ' + src + ' is not finite');
            }
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
    encode(src: number) {
        if (typeof src === 'number') {
            if (!Number.isFinite(src)) {
                throw Error('Number ' + src + ' is not finite');
            }
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
    normalize(src: any) {
        if (typeof src === 'number') {
            if (!Number.isFinite(src)) {
                throw Error('Number ' + src + ' is not finite');
            }
            return src;
        } else {
            throw Error('Input type is not a number');
        }
    }
}

class AnyCodec implements Codec<any> {
    readonly [typeSymbol]!: any;

    decode(src: any) {
        return src;
    }
    encode(src: any) {
        return src;
    }
    normalize(src: any) {
        return src;
    }
}

class OptionalCodec<T> implements Codec<T | null> {
    readonly [typeSymbol]!: T | null;
    private readonly parent: Codec<T>;

    constructor(parent: Codec<T>) {
        this.parent = parent;
    }

    decode(src2: any) {
        if (src2 !== undefined && src2 !== null) {
            return this.parent.decode(src2);
        }
        return null;
    }
    encode(src2: T | null) {
        if (src2 !== undefined && src2 !== null) {
            return this.parent.encode(src2);
        } else {
            return null;
        }
    }
    normalize(src: any) {
        if (src !== undefined && src !== null) {
            return this.parent.normalize(src);
        }
        return null;
    }
}

class DefaultCodec<T> implements Codec<T> {
    readonly [typeSymbol]!: T;
    private readonly defaultValue: () => T;
    private readonly parent: Codec<T | null>;

    constructor(defaultValue: () => T, parent: Codec<T | null>) {
        this.defaultValue = defaultValue;
        this.parent = parent;
    }

    decode(src2: any) {
        if (src2 !== undefined && src2 !== null) {
            return this.parent.decode(src2)!;
        }
        return this.defaultValue();
    }
    encode(src2: T | null) {
        if (src2 !== undefined && src2 !== null) {
            return this.parent.encode(src2)!;
        } else {
            return this.defaultValue();
        }
    }
    normalize(src: any) {
        if (src !== undefined && src !== null) {
            return this.parent.normalize(src)!;
        }
        return this.defaultValue();
    }
}

class EnumCodec<T> implements Codec<T> {
    readonly [typeSymbol]!: T;
    private readonly values: Set<string>;
    private readonly inner = new StringCodec();

    constructor(values: string[]) {
        this.values = new Set(values);
    }

    decode(src: any) {
        let decoded = this.inner.decode(src);
        if (!this.values.has(decoded)) {
            throw Error('String \'' + decoded + '\' is not matched with known enum values');
        }
        return decoded as any;
    }
    encode(src: T) {
        let encoded = this.inner.encode(src as any);
        if (!this.values.has(encoded)) {
            throw Error('String \'' + encoded + '\' is not matched with known enum values');
        }
        return encoded;
    }
    normalize(src: any) {
        let decoded = this.inner.decode(src);
        if (!this.values.has(decoded)) {
            throw Error('String \'' + decoded + '\' is not matched with known enum values');
        }
        return decoded as any;
    }
}

//
// Declares type as K (key) from keys of source object to a values from same keys.
// Then [keyof T] converts type to a union by taking value by key name.
//
type ValuesToUnion<T> = { [K in keyof T]: T[K] }[keyof T];

//
// This will merge two maps to a single map and make intellisence looks much better.
// You have to inline this type to avoid hiding actual types.
//
// type NiceMerge<T1, T2> = { [K in keyof (T1 & T2)]: (T1 & T2)[K] };

export const codecs = {
    string: new StringCodec() as Codec<string>,
    boolean: new BooleanCodec() as Codec<boolean>,
    number: new NumberCodec() as Codec<number>,
    integer: new IntegerCodec() as Codec<number>,
    float: new FloatCodec() as Codec<number>,
    any: new AnyCodec() as Codec<any>,
    enum: <T extends string[]>(...values: T) => {
        return new EnumCodec<T[number]>(values) as Codec<T[number]>;
    },
    array: <T>(src: Codec<T>) => {
        return new ArrayCodec<T>(src) as Codec<T[]>;
    },
    optional: <T>(src: Codec<T>) => {
        return new OptionalCodec<T>(src) as Codec<T | null>;
    },
    struct: <T extends { [key: string]: Codec<any> }>(name: string, src: T) => {
        return new StructCodec<{ [K in keyof T]: T[K][typeof typeSymbol] }>(name, src);
    },
    anyStruct: <T extends { [key: string]: Codec<any> }>(knownStucts: Map<string, Codec<any>>) => {
        return new AnyStructCodec<{ [K in keyof T]: T[K][typeof typeSymbol] }>(knownStucts);
    },
    union: <T extends { [key: string]: StructCodec<any> }>(src: T) => {
        return new UnionCodec<ValuesToUnion<{
            [K in keyof T]:
            /* NiceMerge<{type: K}, T[K][typeof typeSymbol] -> */
            { [K2 in keyof ({ type: K } & T[K][typeof typeSymbol])]: ({ type: K } & T[K][typeof typeSymbol])[K2] } }
            /** <- */
            >>(src);
    },
    default: <T>(src: Codec<T | null>, value: (() => T) | T) => {
        return new DefaultCodec<T>(() => typeof value === 'function' ? src.normalize((value as any)())! : src.normalize(value)!, src) as Codec<T>;
    },
};