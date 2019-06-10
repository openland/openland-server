import { Context } from '@openland/context';
import { AnyFighter } from 'openland-utils/anyfighter';

export interface SLog {
    log: <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => void;
    debug: <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => void;
    warn: <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => void;

    metric: <C extends AnyFighter<C, never, Context>>(ctx: C, name: string, value: number, dimension: string) => void;
}