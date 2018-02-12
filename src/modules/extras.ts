import { JsonMap } from '../utils/json';
import { ExtrasInput } from '../api/Core';

export function buildExtrasFromInput(input?: ExtrasInput | null) {
    let res: JsonMap = {};
    if (input) {
        if (input.strings) {
            for (let f of input.strings) {
                res[f.key] = f.value;
            }
        }
        if (input.floats) {
            for (let f of input.floats) {
                res[f.key] = f.value;
            }
        }
        if (input.ints) {
            for (let f of input.ints) {
                res[f.key] = f.value;
            }
        }
        if (input.enums) {
            for (let f of input.enums) {
                res[f.key] = f.value;
            }
        }
    }
    return res;
}