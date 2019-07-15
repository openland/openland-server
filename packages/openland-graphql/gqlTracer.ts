import { createTracer } from 'openland-log/createTracer';
import { Context, createContextNamespace } from '@openland/context';
import { SSpan } from '../openland-log/SSpan';

export const gqlTraceNamespace = createContextNamespace<GQLTracer | null>('gql-trace', null);

export function withGqlTrace(parent: Context): Context {
    return gqlTraceNamespace.set(parent, new GQLTracer());
}

class ResolveTracePart {
    public finished = false;

    constructor(
        public span: SSpan
    ) {

    }

    finish() {
        this.span.finish();
        this.finished = true;
    }
}

class GQLTracer {
    private tracer = createTracer('gql');
    private parts = new Map<string, ResolveTracePart>();
    private children = new Map<string, ResolveTracePart[]>();
    private rootPart = new ResolveTracePart(this.tracer.startSpan('root'));

    onResolveStart(path: (string|number)[]) {
        let parentPath = path.slice(0, -1).join('.');

        if (typeof path[path.length - 2] === 'number' && !this.parts.has(parentPath)) {
            this.onResolveStart(path.slice(0, -1));
        }

        let parent = this.parts.has(parentPath) ? this.parts.get(parentPath)! : this.rootPart;
        let part = new ResolveTracePart(this.tracer.startSpan(path[path.length - 1].toString(), parent.span));

        this.parts.set(path.join('.'), part);
        this.children.set(parentPath, [...(this.children.get(parentPath) || []), part]);
    }

    onResolveEnd(path: (string|number)[]) {
        this.parts.get(path.join('.'))!.finish();
        if (typeof path[path.length - 2] === 'number') {
            let parentPath = path.slice(0, -1).join('.');
            let parentPart = this.parts.get(parentPath)!;
            let parentChild = this.children.get(parentPath) || [];
            if (this.isPartsFinished(parentChild)) {
                setImmediate(() => {
                    if (this.isPartsFinished(parentChild) && !parentPart.finished) {
                        parentPart.finish();
                        this.tryFinishRoot();
                    }
                });
            }
        }
        if (!this.isAllFinished()) {
            return;
        }
        setImmediate(() => this.tryFinishRoot());
    }

    private isAllFinished() {
        for (let partName of this.parts.keys()) {
            let part = this.parts.get(partName)!;
            if (!part.finished) {
                return false;
            }
        }
        return true;
    }

    private isPartsFinished(parts: ResolveTracePart[]) {
        for (let child of parts) {
            if (!child.finished) {
                return false;
            }
        }
        return true;
    }

    private tryFinishRoot() {
        if (this.isAllFinished() && !this.rootPart.finished) {
            this.rootPart.finish();
        }
    }
}