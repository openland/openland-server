import { Sanitizer } from './Sanitizer';
import { InvalidInputError } from '../openland-errors/InvalidInputError';

export function onlyOneOfKeys<T extends object>(...keys: (keyof T)[]) {
    return (obj: T) => {
        let found = 0;
        for (let [k, v] of Object.entries(obj)) {
            if (keys.length > 0 && !(keys as string[]).includes(k)) {
                continue;
            }
            if (!!v) {
                found++;
            }
        }
        return found === 1;
    };
}

type ValidationRule<T> = (obj: T) => boolean;

export function ensure<T>(obj: T, ...rules: ValidationRule<T>[]) {
    let valid = true;
    for (let rule of rules) {
        if (!rule(obj)) {
            valid = false;
            break;
        }
    }

    return {
        throw: (error: Error | string) => {
            if (valid) {
                return;
            }

            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(error);
            }
        }
    };
}

export const InputValidator = {

    validateEnumString(str: string | null | undefined, ethalon: string[], filedName: string, fieldKey: string, errorAccumulator?: { key: string, message: string }[], nullable?: boolean) {
        let res = Sanitizer.sanitizeString(str);
        let error;
        if (nullable === false && res === null) {
            error = { key: fieldKey, message: filedName + 'values can\'t be empty!' };
        }

        if (res && ethalon.indexOf(res) < 0) {
            error = { key: fieldKey, message: filedName + ' can\'t be ' + str };
        }

        if (error && errorAccumulator) {
            errorAccumulator.push(error);
        } else if (error) {
            throw new InvalidInputError([error]);
        }
    },

    validateEnumStrings(stings: (string | null | undefined)[] | null, ethalon: string[], filedName: string, fieldKey: string, errorAccumulator?: { key: string, message: string }[], nullable?: boolean) {
        let res = Sanitizer.sanitizeAny(stings);
        let error;
        if (nullable === false && (res === null || res.length === 0)) {
            error = { key: fieldKey, message: filedName + ' can\'t be empty!' };
        } else if (res) {
            res.map(s => this.validateEnumString(s, ethalon, filedName, fieldKey, errorAccumulator, false)).filter(s => s !== null);
        }

        if (error && errorAccumulator) {
            errorAccumulator.push(error);
        } else if (error) {
            throw new InvalidInputError([error]);
        }
    },

    validateEmail(str: string | string | null | undefined, fieldKey: string, errorAccumulator?: { key: string, message: string }[], nullable?: boolean) {
        let res = Sanitizer.sanitizeString(str);
        let error;
        if (nullable === false && res === null) {
            error = { key: fieldKey, message: 'email can\'t be empty!' };
        }

        if (res) {
            var lastAtPos = res.lastIndexOf('@');
            var lastDotPos = res.lastIndexOf('.');
            let isEmailValid = lastAtPos < lastDotPos && lastAtPos > 0 && res.indexOf('@@') === -1 && lastDotPos > 2 && (res.length - lastDotPos) > 2;
            if (!isEmailValid) {
                error = { key: fieldKey, message: 'not a valid email address' };
            }
        }

        if (error && errorAccumulator) {
            errorAccumulator.push(error);
        } else if (error) {
            throw new InvalidInputError([error]);
        }

    },

    validateNonEmpty(str: string | string | null, filedName: string, fieldKey: string, errorAccumulator?: { key: string, message: string }[]) {
        let error;
        if (!Sanitizer.sanitizeString(str)) {
            error = { key: fieldKey, message: filedName + ' can\'t be empty' };
        }

        if (error && errorAccumulator) {
            errorAccumulator.push(error);
        } else if (error) {
            throw new InvalidInputError([error]);
        }
    }

};