import { createEmptyContext, createContextNamespace } from './Context';

describe('Context', () => {
    it('should create context, namespace and update values', () => {
        let context = createEmptyContext();
        let namespace = createContextNamespace<number | undefined>('test', undefined);
        expect(namespace.get(context)).toBeUndefined();
        context = namespace.set(context, 10);
        expect(namespace.get(context)).toBe(10);
    });
});