import { SLogImpl } from './src/SLogImpl';
import { SLog } from './SLog';

export function createLogger(name: string): SLog {
    return new SLogImpl(name);
}