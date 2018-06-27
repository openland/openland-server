
export type ValidationPrimitive = string|number;

export type Validator = (value: ValidationPrimitive) => boolean|string;

export type ValidationScheme = { [key: string]: Validator|ValidationScheme|Validator[]|ValidationScheme[] } | Validator;

export type ValidationData = { [key: string]: ValidationPrimitive|ValidationData|ValidationPrimitive[]|ValidationData[] } | ValidationPrimitive;

export type ValidationResult = { key: string, message: string };

//
// usage:
//
// validate({ name: stringNotEmpty }, { name: '' })
//

export function validate(
    scheme: ValidationScheme,
    data: ValidationData,
    keyPath: string[] = []
): ValidationResult[] {

    if (
        scheme instanceof Function &&
        typeof data === 'string' || typeof data === 'number'
    ) {
        let validator = (scheme as Validator);
        let isValid = validator(data);

        if (isValid !== true) {
            return [{
                key: keyPath.join('.'),
                message: isValid as string
            }];
        }

        return [];
    }

    let validationResult: ValidationResult[] = [];

    if (typeof scheme !== 'object') {
        throw new Error('Invalid scheme');
    }
    if (typeof data !== 'object') {
        throw new Error('Invalid data');
    }

    for (let key in scheme) {
        // just to make tslint happy
        if (!scheme.hasOwnProperty(key)) {
            continue;
        }

        let schemeVal = scheme[key];
        let dataValue = data[key];
        let curKeyPath = ([...keyPath, key]).join('.');

        if (dataValue === undefined || dataValue === null) {
            validationResult.push({
                key: curKeyPath,
                message: `${key} cant by empty`
            });
            continue;
        }

        if (schemeVal instanceof Function) {
            let isValid = schemeVal(dataValue as ValidationPrimitive);

            if (isValid !== true) {
                validationResult.push({
                    key: curKeyPath,
                    message: isValid as string
                });
            }
        } else if (schemeVal instanceof Array) {
            if (!(dataValue instanceof Array)) {
                validationResult.push({
                    key: curKeyPath,
                    message: `${key} must be array`
                });
                continue;
            }

            let i = 0;
            for (let arrVal of dataValue) {

                validationResult = [
                    ...validationResult,
                    ...validate(schemeVal[0], arrVal, [...keyPath, key, `${i}`])
                ];
                i++;
            }
        } else {
            validationResult = [
                ...validationResult,
                ...validate(
                    schemeVal,
                    data[key] as ValidationData,
                    [...keyPath, key]
                )
            ];
        }
    }

    return validationResult;
}

export function stringNotEmpty(value: ValidationPrimitive): boolean|string {
    if (typeof value !== 'string') {
        return 'not string';
    }

    return !(!value || /^\s*$/.test(value)) || 'string is empty';
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
