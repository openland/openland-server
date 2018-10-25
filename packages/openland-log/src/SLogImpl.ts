import { SLogContext } from './SLogContext';
import { SLog } from '../SLog';

export class SLogImpl implements SLog {
    private readonly name: String;

    constructor(name: String) {
        this.name = name;
    }

    log = (message?: any, ...optionalParams: any[]) => {
        if (SLogContext.value && SLogContext.value.disabled) {
            return;
        }
        let context = SLogContext.value ? SLogContext.value.path : [];
        console.log(...context, this.name, message, ...optionalParams);
    }

    debug = (message?: any, ...optionalParams: any[]) => {
        if (SLogContext.value && SLogContext.value.disabled) {
            return;
        }
        let context = SLogContext.value ? SLogContext.value.path : [];
        console.debug(...context, this.name, message, ...optionalParams);
    }
}