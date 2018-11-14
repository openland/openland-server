import { SLogContext } from './SLogContext';
import { SLog } from '../SLog';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console(),
    ]
});

export class SLogImpl implements SLog {
    private readonly name: String;
    private readonly production = process.env.NODE_ENV === 'production';

    constructor(name: String) {
        this.name = name;
    }

    log = (message?: any, ...optionalParams: any[]) => {
        if (SLogContext.value && SLogContext.value.disabled) {
            return;
        }
        let context = SLogContext.value ? SLogContext.value.path : [];
        logger.info([...context, this.name, message, ...optionalParams].join(' '));
    }

    debug = (message?: any, ...optionalParams: any[]) => {
        if (this.production) {
            if (SLogContext.value && SLogContext.value.disabled) {
                return;
            }
            let context = SLogContext.value ? SLogContext.value.path : [];
            logger.debug([...context, this.name, message, ...optionalParams].join(' '));
        }
    }
    warn = (message?: any, ...optionalParams: any[]) => {
        if (SLogContext.value && SLogContext.value.disabled) {
            return;
        }
        let context = SLogContext.value ? SLogContext.value.path : [];
        logger.warn([...context, this.name, message, ...optionalParams].join(' '));
    }
}