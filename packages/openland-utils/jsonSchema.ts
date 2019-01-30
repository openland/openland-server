function genTab(n: number): string {
    return new Array(n).fill('    ').join('');
}

function tab(n: number, str: string) {
    let out: string[] = [];
    let parts = str.split('\n');
    for (let part of parts) {
        if (part.length === 0) {
            continue;
        }
        out.push(genTab(n) + part);
    }
    return out.join('\n');
}

class JsonField {
    constructor(
        readonly name: string,
        readonly type: JsonType,
        readonly nullable: boolean
    ) {

    }
}

class JsonType {
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
        return `enum(${this.types.map(t => t.toText()).join(' | ')})`;
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
export class JsonSchema extends JsonType {
    readonly fields: JsonField[] = [];

    addField(field: JsonField) {
        this.fields.push(field);
    }

    toText() {
        let out = '{\n';
        for (let field of this.fields) {
            if (field.type instanceof JsonSchema) {
                out += `${genTab(1)}"${field.name}": ${tab(1, field.type.toText())}\n`;

            } else {
                out += `${genTab(1)}"${field.name}": ${field.type.toText()}\n`;
            }
        }
        out += '}';
        return out;
    }
}

let currentSchemaIndex = -1;
let schemas: JsonSchema[] = [];

export const json = (schema: () => void) => {
    currentSchemaIndex++;
    let _schema = new JsonSchema();
    schemas.push(_schema);
    schema();
    currentSchemaIndex--;
    return _schema;
};
export const inJson = (schema: () => void) => {
    currentSchemaIndex++;
    let _schema = new JsonSchema();
    schemas.push(_schema);
    schema();
    currentSchemaIndex--;
    schemas.pop();
    return _schema;
};
export const jString = () => new StringType();
export const jNumber = () => new NumberType();
export const jBool = () => new BoolType();
export const jVec = (type: JsonType) => new VecType(type);
export const jEnum = (...types: JsonType[]) => new EnumType(types);
export const jEnumString = (...values: string[]) => new StringEnumType(values);

export const jField = (name: string, type: JsonType, nullable = false) => {
    schemas[currentSchemaIndex].addField(new JsonField(name, type, nullable));
};

const Validators = {
    isString: (field: string, value: any) => {
        if (value === undefined || value === null || typeof value !== 'string') {
            throw new Error(`Field ${field} must be string, got: ${value}`);
        }
    },
    isNumber: (field: string, value: any) => {
        if (value === undefined || value === null || typeof value !== 'number') {
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
        Validators.isString(fieldName, value);
    } else if (type instanceof NumberType) {
        Validators.isNumber(fieldName, value);
    } else if (type instanceof BoolType) {
        Validators.isBool(fieldName, value);
    } else if (type instanceof StringEnumType) {
        Validators.isStringEnum(fieldName, value, type.values);
    } else if (type instanceof EnumType) {
        Validators.isEnum(fieldName, value);
        let pass = false;
        for (let enumType of type.types) {
            try {
                validateField([], value, enumType);
                pass = true;
            } catch (e) {
                // nothing to do here
            }
        }
        if (!pass) {
            throw new Error(`Field ${fieldName} should be ${type.toText()}, got: ${value}`);
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
    } else if (type instanceof JsonSchema) {
        if (typeof value !== 'object') {
            throw new Error(`${fieldName} must be object`);
        }

        for (let key in value) {
            let v = value[key];

            let field = type.fields.find(f => f.name === key);

            if (!field) {
                throw new Error(`Extra field "${key}"`);
            }
            fieldsPath.push(key);
            validateField(fieldsPath, v, field.type);
            fieldsPath.pop();
        }

        let missingField = type.fields.filter(f => !f.nullable).find(f => value[f.name] === undefined || value[f.name] === null);

        if (missingField) {
            throw new Error(`${[...fieldsPath, missingField.name].join('.')} field is missing"`);
        }
    }
}

export function validateJson(schema: JsonType, input: any) {
    validateField(['root'], input, schema);
    return true;
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
