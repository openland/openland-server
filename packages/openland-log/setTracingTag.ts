import { TracingContext } from './src/TracingContext';
import { Context } from '@openland/context';

export function setTracingTag(ctx: Context, key: string, value: any) {
    let c = TracingContext.get(ctx);
    if (c) {
        if (c.span) {
            c.span.setTag(key, value);
        }
    }
}