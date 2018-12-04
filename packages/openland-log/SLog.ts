import { Context } from 'openland-utils/Context';
import { AnyFighter } from 'openland-utils/anyfighter';

export interface SLog {
    log: <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => void;
    debug: <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => void;
    warn: <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => void;
}