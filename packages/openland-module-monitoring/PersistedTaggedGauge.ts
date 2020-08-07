import { Context } from '@openland/context';

export class PersistedTaggedGauge {
    readonly name: string;
    readonly description: string;
    readonly query: (ctx: Context) => Promise<{ tag: string, value: number }[]>;

    constructor(name: string, description: string, query: (ctx: Context) => Promise<{ tag: string, value: number }[]>) {
        this.name = name;
        this.description = description;
        this.query = query;
        Object.freeze(this);
    }
}