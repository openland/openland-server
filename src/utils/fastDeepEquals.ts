/**
 * Fast Deep Equals that is usefull for fast check if JSON objects are equals or not.
 * This method can produce false-negative results, but not true-negative one.
 * @param src first object
 * @param dst second object
 */
export function fastDeepEquals(src?: any, dst?: any): boolean {
    if (src === dst) {
        return true;
    } else if (!src || !dst || typeof src !== 'object' && typeof dst !== 'object') {
        return src === dst;
    } else {
        // both values are non-null/undefined objects
        let sKeys = Object.keys(src);
        let dKeys = Object.keys(dst);
        if (sKeys.length !== dKeys.length) {
            return false;
        }

        // Sorting
        sKeys.sort();
        dKeys.sort();

        // Keys compare
        for (let i = 0; i < sKeys.length; i++) {
            if (sKeys[i] !== dKeys[i]) {
                return false;
            }
        }

        // Values compare
        for (let i = 0; i < sKeys.length; i++) {
            let key = sKeys[i];
            if (!fastDeepEquals(src[key], dst[key])) {
                return false;
            }
        }
        return true;
    }
}