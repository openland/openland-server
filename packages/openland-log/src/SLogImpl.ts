import { SLog } from '../SLog';
import winston from 'winston';
import { Context, ContextName } from '@openland/context';
import { SLogContext } from './SLogContext';
import { AnyFighter } from 'openland-utils/anyfighter';

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.simple(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        })
    ),
    transports: [
        new winston.transports.Console(),
    ]
});

function formatMessage(ctx: Context, name: string, message: any, optionalParams: any[]) {
    let v = SLogContext.get(ctx);
    return ContextName.get(ctx) + ' | ' + [...v.path, name].join(' ') + ': ' + [message, ...optionalParams].join(' ');
}

export class SLogImpl implements SLog {
    private readonly name: string;
    private readonly enabled: boolean = true;
    private readonly production = process.env.NODE_ENV === 'production';

    constructor(name: string, enabled: boolean) {
        this.name = name;
        this.enabled = enabled;
    }

    log = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        let v = SLogContext.get(ctx);
        if (this.enabled) {
            if (v.disabled) {
                return;
            }

            logger.info(formatMessage(ctx, this.name, message, optionalParams));
        }
    }

    debug = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        let v = SLogContext.get(ctx);
        if (this.enabled) {
            if (this.production) {
                if (v.disabled) {
                    return;
                }

                logger.debug(formatMessage(ctx, this.name, message, optionalParams));
            }
        }
    }
    warn = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        // let v = SLogContext.get(ctx);
        if (this.enabled) {
            // if (v.disabled) {
            //     return;
            // }
            logger.warn(formatMessage(ctx, this.name, message, optionalParams));
        }
    }
}