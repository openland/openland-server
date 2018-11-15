import { Context } from 'openland-utils/Context';
import { SSpan } from './SSpan';

export interface STracer {
    startSpan(name: string, parent?: SSpan): SSpan;
    trace<T>(ctx: Context, op: string, handler: (ctx: Context) => Promise<T>): Promise<T>;
    traceSync<T>(ctx: Context, op: string, handler: (ctx: Context) => T): T;
}