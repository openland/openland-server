import { Context } from 'openland-utils/Context';

export interface SLog {
    log: (ctx: Context, message?: any, ...optionalParams: any[]) => void;
    debug: (ctx: Context, message?: any, ...optionalParams: any[]) => void;
    warn: (ctx: Context, message?: any, ...optionalParams: any[]) => void;
}