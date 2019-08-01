import { createLogger, Logger, LogPathContext } from '@openland/log';
import { LogConfig } from '@openland/log/lib/impl/LogConfig';
import { AnyFighter } from '@openland/log/lib/utils/AnyFighter';
import { Context, ContextName } from '@openland/context';
import { format } from 'util';

function formatMessage(ctx: Context, name: string, message: string) {
    let v = LogPathContext.get(ctx);
    return ContextName.get(ctx) + ' | ' + [...v, name].join(' ➾ ') + ': ' + message;
}

export class ZippedLogger implements Logger {
    readonly service: string;
    enabled: boolean;
    readonly allowDisablingSeverLevels: boolean;
    private logs = new Map<string, { times: number, lastCtx: Context, level: 'info' | 'debug' | 'warn' | 'error' }>();

    constructor(service: string) {
        this.service = service;
        this.enabled = !LogConfig.disabledAll && !LogConfig.disabledServices.has(service.toLowerCase());
        this.allowDisablingSeverLevels = LogConfig.allowDisablingSeverLevels;

        let logger = createLogger(service);

        setInterval(() => {
            for (let msg of this.logs.keys()) {
                let d = this.logs.get(msg)!;
                if (d.level === 'info' ) {
                    logger.log(d.lastCtx, msg, d.times);
                } else if (d.level === 'debug') {
                    logger.debug(d.lastCtx, msg, d.times);
                } else if (d.level === 'warn') {
                    logger.warn(d.lastCtx, msg, d.times);
                } else if (d.level === 'error') {
                    logger.error(d.lastCtx, msg, d.times);
                }
            }
            this.logs.clear();
        },  1000 * 60);
    }

    //
    // Logging
    //

    log<C extends AnyFighter<C, never, Context>>(ctx: C, message: any, ...param: any[]) {
        if (!this.enabled) {
            return;
        }
        this._log(ctx, 'info', message, ...param);
    }
    debug<C extends AnyFighter<C, never, Context>>(ctx: C, message: any, ...param: any[]) {
        if (!this.enabled) {
            return;
        }
        this._log(ctx, 'debug', message, ...param);
    }
    warn<C extends AnyFighter<C, never, Context>>(ctx: C, message: any, ...param: any[]) {
        if (!this.enabled && this.allowDisablingSeverLevels) {
            return;
        }
        this._log(ctx, 'warn', message, ...param);
    }
    error<C extends AnyFighter<C, never, Context>>(ctx: C, message: any, ...param: any[]) {
        if (!this.enabled && this.allowDisablingSeverLevels) {
            return;
        }
        this._log(ctx, 'error', message, ...param);
    }

    // Metrics

    metric<C extends AnyFighter<C, never, Context>>(ctx: C, name: string, value: number, dimension: string) {
        LogConfig.logProvider.metric(ctx, this.service, name, value, dimension);
    }

    // Management
    forceEnable() {
        this.enabled = true;
    }

    private _log<C extends AnyFighter<C, never, Context>>(ctx: C, _level: 'info' | 'debug' | 'warn' | 'error', message: any, ...param: any[]) {
        if (!this.enabled) {
            return;
        }
        let formatted = format(message, ...param);
        let msg = formatMessage(ctx, this.service, formatted);
        if (this.logs.has(msg)) {
            let prev = this.logs.get(msg)!;
            prev.times++;
            prev.lastCtx = ctx;
        } else {
            this.logs.set(msg, { times: 1, lastCtx: ctx, level: _level });
        }
    }
}

export function createZippedLogger(service: string): Logger {
    return new ZippedLogger(service);
}