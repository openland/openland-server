import { Sanitizer } from './Sanitizer';
import { InvalidInputError } from '../errors/InvalidInputError';

export const InputValidator = {

    validateEnumString(str: string | null | undefined, ethalon: (string | null)[], filedName: string, fieldKey: string, errorAccumulator?: { key: string, message: string }[], nullable?: boolean) {
        let res = Sanitizer.sanitizeString(str);
        let error;
        if (!nullable && res === null) {
            error = { key: fieldKey, message: filedName + 'values can\'t be empty!' };
        } else if (ethalon.indexOf(res) < 0) {
            error = { key: fieldKey, message: filedName + ' can`t be ' + str };
        } 

        if (error && errorAccumulator) {
            errorAccumulator.push(error);
        } else if (error) {
            throw new InvalidInputError([error]);
        }
    },

    validateEnumStrings(stings: (string | null | undefined)[] | null, ethalon: (string | null)[], filedName: string, fieldKey: string, errorAccumulator?: { key: string, message: string }[], nullable?: boolean) {
        let res = Sanitizer.sanitizeAny(stings);
        let error;
        if (nullable === false && (res === null || res.length === 0)) {
            error = { key: fieldKey, message: filedName + ' can\'t be empty!' };
        } else if (res) {
            res.map(s => this.validateEnumString(s, ethalon, filedName, fieldKey, errorAccumulator)).filter(s => s !== null);
        }

        if (error && errorAccumulator) {
            errorAccumulator.push(error);
        } else if (error) {
            throw new InvalidInputError([error]);
        }
    }

};