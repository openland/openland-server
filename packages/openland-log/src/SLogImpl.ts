import { SLog } from '../SLog';
import winston from 'winston';
import { Context } from 'openland-utils/Context';
import { SLogContext } from './SLogContext';
import { AnyFighter } from 'openland-utils/anyfighter';

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console(),
    ]
});

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
            logger.info([...v.path].join(' ') + ' | ' + this.name + ': ' + [message, ...optionalParams].join(' '));
        }
    }

    debug = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        let v = SLogContext.get(ctx);
        if (this.enabled) {
            if (this.production) {
                if (v.disabled) {
                    return;
                }
                logger.debug([...v.path].join(' ') + ' | ' + this.name + ': ' + [message, ...optionalParams].join(' '));
            }
        }
    }
    warn = <C extends AnyFighter<C, never, Context>>(ctx: C, message?: any, ...optionalParams: any[]) => {
        let v = SLogContext.get(ctx);
        if (this.enabled) {
            // if (v.disabled) {
            //     return;
            // }
            logger.warn([...v.path].join(' ') + ' | ' + this.name + ': ' + [message, ...optionalParams].join(' '));
        }
    }
}