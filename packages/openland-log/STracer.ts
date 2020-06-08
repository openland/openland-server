import { Context } from '@openland/context';
import { SSpan } from './SSpan';

export interface STracer {
    startSpan(name: string, parent?: SSpan): SSpan;
    trace<T>(ctx: Context, op: string, handler: (ctx: Context) => Promise<T>): Promise<T>;
}