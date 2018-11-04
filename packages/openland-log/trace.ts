import { STracer } from './src/STracer';
import { STraceContext } from './src/STraceContext';

export async function trace<T>(tracer: STracer, name: string, func: () => Promise<T> | T) {
    let parent = STraceContext.value;
    if (parent && parent.currentSpan) {
        const span = tracer.startSpan(name, parent.currentSpan!);
        try {
            return await STraceContext.withContext({ currentSpan: span }, async () => {
                return await func();
            });
        } finally {
            span.finish();
        }
    } else {
        return await func();
    }
}

export function traceSync<T>(tracer: STracer, name: string, func: () => T) {
    let parent = STraceContext.value;
    if (parent && parent.currentSpan) {
        const span = tracer.startSpan(name, parent.currentSpan!);
        try {
            return STraceContext.withContext({ currentSpan: span }, () => {
                return func();
            });
        } finally {
            span.finish();
        }
    } else {
        return func();
    }
}