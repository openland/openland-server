function isObject(obj: any) {
    return obj && typeof obj === 'object';
}

function mergeBoth(target: any, source: any): any {

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = targetValue.concat(sourceValue);
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = mergeBoth(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

export function merge(...args: any) {
    return args.reduce((acc: any, val: any) => {
        return mergeBoth(acc, val);
    }, {});
}
