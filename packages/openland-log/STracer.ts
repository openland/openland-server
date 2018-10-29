import { SSpan } from './src/STracer';

export interface STracer {
    startSpan(name: string, parent?: SSpan): SSpan;
}