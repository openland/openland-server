import { STracer, SSpan } from './src/STracer';
import { STraceContext } from './src/STraceContext';

export async function withTracing<T>(tracer: STracer, name: string, func: () => Promise<T> | T) {
    let parent = STraceContext.value;
    const span = tracer.startSpan(name, parent && parent.currentSpan ? parent.currentSpan! : undefined);
    try {
        return await STraceContext.withContext({ currentSpan: span }, async () => {
            return await func();
        });
    } finally {
        span.finish();
    }
}

export async function withTracingSpan<T>(span: SSpan, func: () => Promise<T> | T) {
    try {
        return await STraceContext.withContext({ currentSpan: span }, async () => {
            return await func();
        });
    } finally {
        span.finish();
    }
}