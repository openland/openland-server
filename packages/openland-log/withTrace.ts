import { STracer } from './src/STracer';

export async function withTracing<T>(name: string, func: () => Promise<T> | T) {
    const span = STracer.startSpan(name);
    let res = await func();
    span.finish();
    return res;
}