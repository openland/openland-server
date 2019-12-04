import { inspect } from 'util';
import { genTab, tab } from './string';

class JsonField {
    constructor(
        readonly name: string,
        readonly type: JsonType,
        public isNullable: boolean = false,
        public isUndefinable: boolean = false,
    ) {

    }

    nullable() {
        this.isNullable = true;
    }

    undefinable() {
        this.isUndefinable = true;
    }
}

export class JsonType {
    public toText(): string {
        return 'BasicType';
    }
}
class NumberType extends JsonType {
    toText() {
        return 'number';
    }
}
class StringType extends JsonType {
    readonly exactValue?: string;
    constructor(exactValue?: string) {
        super();
        this.exactValue = exactValue;
    }

    toText() {
        return 'string';
    }
}
class BoolType extends JsonType {
    toText() {
        return 'bool';
    }
}
class VecType extends JsonType {
    constructor(
        readonly type: JsonType
    ) {
        super();
    }

    toText() {
        return `vec[${this.type.toText()}]`;
    }
}
class EnumType extends JsonType {
    constructor(
        readonly types: JsonType[]
    ) {
        super();
    }

    toText() {
        return tab(1, `enum(${this.types.map(t => t.toText()).join(' | ')})`);
    }
}
class StringEnumType extends JsonType {
    constructor(
        readonly values: string[]
    ) {
        super();
    }

    toText() {
        return `stringEnum(${this.values.join(' | ')})`;
    }
}
class ObjectType extends JsonType {
    readonly fields: JsonField[] = [];

    addField(field: JsonField) {
        this.fields.push(field);
    }

    toText() {
        let out = '{\n';
        for (let field of this.fields) {
            if (field.type instanceof ObjectType) {
                out += `${genTab(1)}"${field.name}": ${tab(1, field.type.toText())}\n`;

            } else {
                out += `${genTab(1)}"${field.name}": ${field.type.toText()}\n`;
            }
        }
        out += '}';
        return out;
    }
}

export type JsonSchema = NumberType | StringType | BoolType | VecType | EnumType | StringEnumType | ObjectType;

let schemas: ObjectType[] = [];

export const json = (schema: () => void) => {
    let _schema = new ObjectType();
    schemas.push(_schema);
    schema();
    schemas.pop();
    return _schema;
};
export const jString = (value?: string) => new StringType(value);
export const jNumber = () => new NumberType();
export const jBool = () => new BoolType();
export const jVec = (type: JsonType) => new VecType(type);
export const jEnum = (...types: JsonType[]) => new EnumType(types);
export const jEnumString = (...values: string[]) => new StringEnumType(values);

export const jField = (name: string, type: JsonType) => {
    let schema = schemas[schemas.length - 1];

    if (!schema) {
        throw new Error('jField can\'t be called outside of json()');
    }
    let field = new JsonField(name, type);
    schema.addField(field);
    return field;
};

class JsonExtraFieldError extends Error { }

const Validators = {
    isString: (field: string, value: any, expected?: string) => {
        if (value === undefined || value === null || typeof value !== 'string') {
            throw new Error(`Field ${field} must be string, got: ${value}`);
        } else if (expected && value !== expected) {
            throw new Error(`Field ${field} must be ${expected}, got: ${value}`);
        }
    },
    isNumber: (field: string, value: any) => {
        if (value === undefined || value === null || typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error(`Field ${field} must be number, got: ${value}`);
        }
    },
    isBool: (field: string, value: any) => {
        if (value === undefined || value === null || typeof value !== 'boolean') {
            throw new Error(`Field ${field} must be boolean, got: ${value}`);
        }
    },
    isStringEnum: (field: string, value: any, enumValues: string[]) => {
        if (value === undefined || value === null || typeof value !== 'string') {
            throw new Error(`Field ${field} must be string, got: ${value}`);
        }

        if (enumValues.indexOf(value) === -1) {
            throw new Error(`Field ${field} must be one of ${enumValues.join(',')}, got: ${value}`);
        }
    },
    isEnum: (field: string, value: any) => {
        if (value === undefined || value === null) {
            throw new Error(`Field ${field} can't be null or undefined, got: ${value}`);
        }
    },
    isVec: (field: string, value: any) => {
        if (value === undefined || value === null || !Array.isArray(value)) {
            throw new Error(`Field ${field} should be vector, got: ${value}`);
        }
    }
};

function validateField(fieldsPath: string[] = [], value: any, type: JsonType) {
    let fieldName = fieldsPath.join('.');

    if (type instanceof StringType) {
        Validators.isString(fieldName, value, type.exactValue);
    } else if (type instanceof NumberType) {
        Validators.isNumber(fieldName, value);
    } else if (type instanceof BoolType) {
        Validators.isBool(fieldName, value);
    } else if (type instanceof StringEnumType) {
        Validators.isStringEnum(fieldName, value, type.values);
    } else if (type instanceof EnumType) {
        Validators.isEnum(fieldName, value);
        let pass = false;
        let errors: Error[] = [];
        for (let enumType of type.types) {
            try {
                validateField([], value, enumType);
                pass = true;
            } catch (e) {
                errors.push(e);
            }
        }
        if (!pass) {
            errors.sort((a, b) => a instanceof JsonExtraFieldError ? 1 : -1);
            throw new Error(`Field ${fieldName} should be ${type.toText()}, got: ${inspect(value)}, possible error: ${errors[0].message}`);
        }
    } else if (type instanceof VecType) {
        Validators.isVec(fieldName, value);
        let i = 0;
        for (let val of value) {
            fieldsPath.push(`[${i}]`);
            validateField(fieldsPath, val, type.type);
            fieldsPath.pop();
            i++;
        }
    } else if (type instanceof ObjectType) {
        if (typeof value !== 'object') {
            throw new Error(`${fieldName} must be object`);
        }

        for (let key in value) {
            let v = value[key];

            let field = type.fields.find(f => f.name === key);

            if (!field) {
                throw new JsonExtraFieldError(`Extra field "${key}"`);
            }
            if (field.isNullable && v === null) {
                continue;
            }
            if (field.isUndefinable && v === undefined) {
                continue;
            }
            fieldsPath.push(key);
            validateField(fieldsPath, v, field.type);
            fieldsPath.pop();
        }

        let missingField = type.fields.filter(f => !f.isUndefinable).find(f => value[f.name] === undefined);

        if (missingField) {
            throw new Error(`${[...fieldsPath, missingField.name].join('.')} field is missing"`);
        }
    }
}

export function validateJson(schema: JsonType, input: any) {
    validateField(['root'], input, schema);
    return true;
}

export function generateJsonSchema(schema: JsonSchema): string {
    if (schema instanceof NumberType) {
        return 'jNumber()';
    } else if (schema instanceof StringType) {
        return schema.exactValue ? `jString('${schema.exactValue}')` : 'jString()';
    } else if (schema instanceof BoolType) {
        return 'jBool()';
    } else if (schema instanceof VecType) {
        return `jVec(${generateJsonSchema(schema.type)})`;
    } else if (schema instanceof EnumType) {
        return `jEnum(\n${tab(1, schema.types.map(generateJsonSchema).join(', \n'))}\n)`;
    } else if (schema instanceof StringEnumType) {
        return `jEnumString(${schema.values.map(v => `'${v}'`).join(', ')})`;
    } else if (schema instanceof ObjectType) {
        let res = '';

        res += 'json(() => {\n';
        for (let field of schema.fields) {
            if (field.isNullable) {
                res += `${genTab(1)}jField('${field.name}', ${generateJsonSchema(field.type)}).nullable();\n`;
            } else if (field.isUndefinable) {
                res += `${genTab(1)}jField('${field.name}', ${generateJsonSchema(field.type)}).undefinable();\n`;
            } else {
                res += `${genTab(1)}jField('${field.name}', ${generateJsonSchema(field.type)});\n`;
            }
        }
        res += '})';

        return res;
    }

    throw new Error('Can\'t generate schema');
}

export function generateJsonSchemaInterface(schema: JsonSchema): string {
    if (schema instanceof NumberType) {
        return 'number';
    } else if (schema instanceof StringType) {
        return schema.exactValue ? `'${schema.exactValue}'` : 'string';
    } else if (schema instanceof BoolType) {
        return 'boolean';
    } else if (schema instanceof VecType) {
        return `(${generateJsonSchemaInterface(schema.type)})[]`;
    } else if (schema instanceof EnumType) {
        return schema.types.map(generateJsonSchemaInterface).join(' | ');
    } else if (schema instanceof StringEnumType) {
        return schema.values.map(v => `'${v}'`).join(' | ');
    } else if (schema instanceof ObjectType) {
        let res = '';

        res += '{ ';
        for (let field of schema.fields) {
            res += `${field.name}: ${generateJsonSchemaInterface(field.type)}${field.isNullable ? ' | null' : field.isUndefinable ? ' | undefined' : ''}, `;
        }
        res += '}';

        return res;
    }

    throw new Error('Can\'t generate schema');
}

// json(() => {
//     jField('kek', jString())
//     jField('lol', jString())
//     jField('mda', jNumber())
//     jField('mda2', jVec(jNumber()))
//     jField('enum', jEnum(jNumber(), jBool()))
//     jField('enums', jEnumString('1', '2'))
//
//
//     jField('user', inJson(() => {
//         jField('firstName', jString())
//         jField('lastName', jString())
//         jField('vars', jVec(inJson(() => {
//             jField('a', jString())
//         })))
//     }))
// })
// validateJson(
//     schemas[0],
//     {
//         kek: '1',
//         lol: '1',
//         mda: 1,
//         mda2: [1, 9],
//         enum: 1,
//         enums: '1',
//         user: {
//             firstName: '1',
//             lastName: '1',
//             vars: [{ a: 'true' }]
//         }
//     }
// )
// let s = jEnum(
//     inJson(() => {
//         jField('a', jString())
//         jField('b', jString())
//     }),
//     inJson(() => {
//         jField('a', jString())
//         jField('c', jString())
//     }),
// )
// console.log(s.toText())
// validateJson(
//     s,
//     {
//         a: '1',
//         c: '1'
//     }
// )
