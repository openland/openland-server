const MAX_ARRAY_LENGTH = 10;
const MAX_RECURSIVE_DEPTH = 2;

/**
 * Used to print values in error messages.
 */
export function inspect(value: unknown): string {
    return formatValue(value, []);
}

function formatValue(value: unknown, seenValues: Array<unknown>): string {
    switch (typeof value) {
        case 'string':
            return JSON.stringify(value);
        case 'function':
            return value.name ? `[function ${value.name}]` : '[function]';
        case 'object':
            if (value === null) {
                return 'null';
            }
            return formatObjectValue(value, seenValues);
        default:
            return String(value);
    }
}

function formatObjectValue(
    value: Array<object> | object,
    previouslySeenValues: Array<unknown>,
): string {
    if (previouslySeenValues.indexOf(value) !== -1) {
        return '[Circular]';
    }

    const seenValues = [...previouslySeenValues, value];

    if (hasToJSON(value)) {
        const jsonValue = value.toJSON(value);

        // check for infinite recursion
        if (jsonValue !== value) {
            return typeof jsonValue === 'string'
                ? jsonValue
                : formatValue(jsonValue, seenValues);
        }
    } else if (Array.isArray(value)) {
        return formatArray(value, seenValues);
    }

    return formatObject(value, seenValues);
}

function formatObject(object: Object, seenValues: Array<unknown>): string {
    const keys = Object.keys(object);
    if (keys.length === 0) {
        return '{}';
    }

    if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return '[' + getObjectTag(object) + ']';
    }

    const properties = keys.map((key) => {
        const value = formatValue((object as any)[key], seenValues);
        return key + ': ' + value;
    });

    return '{ ' + properties.join(', ') + ' }';
}

function formatArray(
    array: Array<unknown>,
    seenValues: Array<unknown>,
): string {
    if (array.length === 0) {
        return '[]';
    }

    if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return '[Array]';
    }

    const len = Math.min(MAX_ARRAY_LENGTH, array.length);
    const remaining = array.length - len;
    const items = [];

    for (let i = 0; i < len; ++i) {
        items.push(formatValue(array[i], seenValues));
    }

    if (remaining === 1) {
        items.push('... 1 more item');
    } else if (remaining > 1) {
        items.push(`... ${remaining} more items`);
    }

    return '[' + items.join(', ') + ']';
}

function getObjectTag(object: Object): string {
    const tag = Object.prototype.toString
        .call(object)
        .replace(/^\[object /, '')
        .replace(/]$/, '');

    if (tag === 'Object' && typeof object.constructor === 'function') {
        const name = object.constructor.name;
        if (typeof name === 'string' && name !== '') {
            return name;
        }
    }

    return tag;
}

function hasToJSON(
    value: object,
): value is object & { toJSON: (value?: unknown) => unknown } {
    return (
        value &&
        'toJSON' in value &&
        typeof (value as { toJSON: () => unknown }).toJSON === 'function'
    );
}