import { SLogImpl } from './src/SLogImpl';
import { SLog } from './SLog';

export function createLogger(name: string, enabled: boolean = true): SLog {
    return new SLogImpl(name, enabled);
}