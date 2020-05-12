import { Context } from '@openland/context';

export class PersistedGauge {
    readonly name: string;
    readonly description: string;
    readonly query: (ctx: Context) => Promise<number>;

    constructor(name: string, description: string, query: (ctx: Context) => Promise<number>) {
        this.name = name;
        this.description = description;
        this.query = query;
        Object.freeze(this);
    }
}