import { InvalidInputError } from '../openland-errors/InvalidInputError';

export type ValidationPrimitive = string | number;

export type Validator = (value: ValidationPrimitive, keyName: string) => boolean | string | Promise<boolean | string>;

export type ValidationScheme = { [key: string]: Validator | ValidationScheme | (Validator | undefined)[] | (ValidationScheme | undefined)[] | boolean } | Validator;

export type ValidationData = { [key: string]: ValidationPrimitive | ValidationData | ValidationPrimitive[] | ValidationData[] | any } | ValidationPrimitive | undefined | null;

export type ValidationResult = { key: string, message: string };

export async function validate(scheme: ValidationScheme, data: ValidationData, keyPath?: string): Promise<void> {
    let result = await validateInternal(
        scheme,
        data,
        keyPath ? keyPath.split('.') : []
    );

    if (result.length > 0) {
        throw new InvalidInputError(result);
    }
}

function isValidator(scheme: ValidationScheme): scheme is Validator {
    return scheme instanceof Function;
}

// usage:
//
// validate(
//     {
//         name: optional(stringNotEmpty()),                       // optional field
//         lastName: defined(stringNotEmpty()),                    // required field
//         texts: [stringNotEmpty()],                              // array
//         names: [, stringNotEmpty()],                            // optional array
//         users: [ { name: defined(stringNotEmpty()) } ],         // complex array
//
//         friend: { name: defined(stringNotEmpty()) },            // object
//         home: { city: defined(stringNotEmpty()), _opt: true }   // optional object
//     },
//     {
//         names: '',
//     }
// );

async function validateInternal(
    scheme: ValidationScheme,
    data: ValidationData,
    keyPath: string[] = []
): Promise<ValidationResult[]> {

    //
    // Field Validation
    //

    if (isValidator(scheme)) {
        if (typeof data === 'string' || typeof data === 'number') {
            let isValid = await scheme(data, keyPath.join('.'));

            if (isValid !== true) {
                return [{
                    key: keyPath.join('.'),
                    message: isValid as string
                }];
            }

            return [];
        } else {
            throw new Error('Invalid scheme');
        }
    }

    //
    // Remaing
    //

    let validationResult: ValidationResult[] = [];
    if (typeof data !== 'object' || data === null || data === undefined) {
        if (scheme._opt === true) {
            return [];
        }

        throw new Error(`${keyPath.join('.')} can't be empty`);
    }

    for (let key in scheme) {
        // just to make tslint happy
        if (!scheme.hasOwnProperty(key)) {
            continue;
        }

        let schemeVal = scheme[key];
        let dataValue = data[key];
        let curKeyPath = ([...keyPath, key]).join('.');

        // if (dataValue === undefined || dataValue === null) {
        //     validationResult.push({
        //         key: curKeyPath,
        //         message: `${key} cant by empty`
        //     });
        //     continue;
        // }

        if (schemeVal instanceof Function) {
            let isValid = await schemeVal(dataValue as ValidationPrimitive, curKeyPath);

            if (isValid !== true) {
                validationResult.push({
                    key: curKeyPath,
                    message: isValid as string
                });
            }
        } else if (Array.isArray(schemeVal)) {
            let isOptional = schemeVal[0] === undefined;
            let itemValidator = isOptional ? schemeVal[1] : schemeVal[0];

            if (!Array.isArray(dataValue)) {
                if (isOptional) {
                    continue;
                } else {
                    validationResult.push({
                        key: curKeyPath,
                        message: `${key} can't be empty`
                    });
                    continue;
                }
            }

            let i = 0;
            for (let arrVal of dataValue) {
                validationResult = [
                    ...validationResult,
                    ...await validateInternal(itemValidator!, arrVal, [...keyPath, key, `${i}`])
                ];
                i++;
            }
        } else if (typeof schemeVal === 'object') {
            validationResult = [
                ...validationResult,
                ...await validateInternal(
                    schemeVal,
                    data[key] as ValidationData,
                    [...keyPath, key]
                )
            ];
        }
    }

    return validationResult;
}

export function stringNotEmpty(message?: string) {
    return (value: ValidationPrimitive, key: string) => {
        if (typeof value !== 'string') {
            return 'not string';
        }

        return (!(!value || /^\s*$/.test(value))) || (message || `${key} can\'t be empty`);
    };
}

export function numberInRange(from: number, to: number) {
    return (value: ValidationPrimitive) => {
        if (typeof value !== 'number') {
            return 'not number';
        }

        if (value >= from && value <= to) {
            return true;
        }

        return 'not in range';
    };
}

export function isNumber(message?: string) {
    return (value: ValidationPrimitive) => {
        if (typeof value !== 'number') {
            return message ? message : 'not number';
        }

        return true;
    };
}

export function enumString(strings: string[], message?: string) {
    return (value: ValidationPrimitive, key: string) => {
        if (typeof value !== 'string') {
            return 'not string';
        }

        if (strings.indexOf(value) < 0) {
            return message || `${key} can't be ${value}`;
        }

        return true;
    };
}

export function optional(validator: Validator) {
    return (value: ValidationPrimitive, keyName: string) => {
        if (value === undefined || value === null) {
            return true;
        }

        return validator(value, keyName);
    };
}

export function optionalNotNull(validator: Validator) {
    return (value: ValidationPrimitive, keyName: string) => {
        if (value === undefined) {
            return true;
        }

        if (value === null) {
            return `${keyName} can't be empty`;
        }

        return validator(value, keyName);
    };
}

export function defined(validator: Validator) {
    return (value: ValidationPrimitive, keyName: string) => {
        if (value === undefined || value === null) {
            return `${keyName} can't be empty`;
        }

        return validator(value, keyName);
    };
}

export function emailValidator(value: ValidationPrimitive, keyName: string) {
    if (typeof value !== 'string') {
        return 'not string';
    }

    var lastAtPos = value.lastIndexOf('@');
    var lastDotPos = value.lastIndexOf('.');
    let isEmailValid = lastAtPos < lastDotPos && lastAtPos > 0 && value.indexOf('@@') === -1 && lastDotPos > 2 && (value.length - lastDotPos) > 2;

    if (!isEmailValid) {
        return 'not a valid email address';
    }

    return true;
}

export function mustBeArray(validator: ValidationScheme) {
    return [validator];
}
export function mustBeOptionalArray(validator: ValidationScheme) {
    return [, validator];
}