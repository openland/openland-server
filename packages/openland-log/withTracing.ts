import { STracer } from './src/STracer';
import { STraceContext } from './src/STraceContext';

export async function withTracing<T>(name: string, func: () => Promise<T> | T) {
    let parent = STraceContext.value;
    const span = STracer.startSpan(name, parent && parent.currentSpan ? parent.currentSpan! : undefined);
    try {
        return await STraceContext.withContext({ currentSpan: span }, async () => {
            return await func();
        });
    } finally {
        span.finish();
    }
}