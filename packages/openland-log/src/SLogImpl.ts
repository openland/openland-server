import { SLog } from '../SLog';
import winston from 'winston';
import { Context, ContextName } from '@openland/context';
import { SLogContext, SLogContext2 } from './SLogContext';
import { AnyFighter } from 'openland-utils/anyfighter';

const format = process.env.NODE_ENV === 'production' ?
    winston.format.combine(
        winston.format.json(),
        winston.format.timestamp()
    ) :
    winston.format.combine(
        winston.format.simple(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        })
    );

const logger = winston.createLogger({
    level: 'debug',
    format: format,
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
    private readonly jest = !!process.env.JEST_WORKER_ID;

    constructor(name: string, enabled: boolean) {
        this.name = name;
        this.enabled = enabled;
    }

    log = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        let v = SLogContext.get(ctx);
        if (this.enabled && !this.jest) {
            if (v.disabled) {
                return;
            }

            if (this.production) {
                logger.info({
                    app: {
                        ...SLogContext2.get(ctx),
                        context: ContextName.get(ctx),
                        service: this.name,
                        text: [message, ...optionalParams].join(' ')
                    },
                    message: formatMessage(ctx, this.name, message, optionalParams)
                });
            } else {
                logger.info(formatMessage(ctx, this.name, message, optionalParams));
            }
        }
    }

    debug = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        let v = SLogContext.get(ctx);
        if (this.enabled && !this.jest) {
            if (this.production) {
                if (v.disabled) {
                    return;
                }

                logger.debug({
                    app: {
                        ...SLogContext2.get(ctx),
                        context: ContextName.get(ctx),
                        service: this.name,
                        text: [message, ...optionalParams].join(' ')
                    },
                    message: formatMessage(ctx, this.name, message, optionalParams)
                });
            }
        }
    }
    warn = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        // let v = SLogContext.get(ctx);
        if (this.enabled && !this.jest) {
            // if (v.disabled) {
            //     return;
            // }
            if (this.production) {
                logger.warn({
                    app: {
                        ...SLogContext2.get(ctx),
                        context: ContextName.get(ctx),
                        service: this.name,
                        text: [message, ...optionalParams].join(' ')
                    },
                    message: formatMessage(ctx, this.name, message, optionalParams)
                });
            } else {
                logger.warn(formatMessage(ctx, this.name, message, optionalParams));
            }
        }
    }
}