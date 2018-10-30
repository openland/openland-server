export class FDBValidationError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export const validators = {
    notNull: (name: string, value: any) => {
        if (value === undefined || value === null) {
            throw new FDBValidationError('\'' + name + '\' can\'t be null or undefined');
        }
    },
    isNumber: (name: string, value: any) => {
        if ((value !== undefined && value !== null) && typeof value !== 'number') {
            throw new FDBValidationError('\'' + name + '\' must be a number, got: ' + value);
        }
    },
    isString: (name: string, value: any) => {
        if ((value !== undefined && value !== null) && typeof value !== 'string') {
            throw new FDBValidationError('\'' + name + '\' must be a string, got: ' + value);
        }
    },
    isBoolean: (name: string, value: any) => {
        if ((value !== undefined && value !== null) && typeof value !== 'boolean') {
            throw new FDBValidationError('\'' + name + '\' must be a boolean, got: ' + value);
        }
    },
    isEnum: (name: string, value: any, enumValues: string[]) => {
        if ((value !== undefined && value !== null)) {
            if (typeof value !== 'string') {
                throw new FDBValidationError('\'' + name + '\' must be a string value, got: ' + value);
            }
            for (let i = 0; i < enumValues.length; i++) {
                if (value === enumValues[i]) {
                    return;
                }
            }
            throw new FDBValidationError('\'' + name + '\' string \'' + value + '\' is matched with known enum values');
        }
    }
};