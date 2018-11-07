export interface SSpan {
    finish(): void;
}

export interface STracer {
    startSpan(name: string, parent?: SSpan, args?: any): SSpan;
}

export class NoOpSpan implements SSpan {
    finish() {
        // Nothing to do
    }
}

export class NoOpTracer implements STracer {
    startSpan(name: string, parent?: SSpan, args?: any) {
        return new NoOpSpan();
    }
}

export class OpenSpan implements SSpan {
    readonly instance: any;
    private readonly tracer: any;

    constructor(src: any, name: string, parent?: SSpan, args?: any) {
        this.tracer = src;
        this.instance = this.tracer.startSpan(name, { ...args, childOf: parent ? (parent as any).instance : undefined });
    }

    finish() {
        this.instance.finish();
    }
}

export class OpenTracer implements STracer {
    private readonly tracer: any;

    constructor(src: any) {
        this.tracer = src;
    }

    startSpan(name: string, parent?: SSpan) {
        return new OpenSpan(this.tracer, name, parent);
    }
}