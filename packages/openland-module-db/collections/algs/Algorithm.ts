import { Context } from '@openland/context';

export interface Algorithm {
    add(ctx: Context, collection: Buffer, id: number): Promise<void>;
    remove(ctx: Context, collection: Buffer, id: number): Promise<void>;
    count(ctx: Context, collection: Buffer, cursor: { from?: number | null, to?: number | null }): Promise<number>;
}