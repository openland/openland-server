import { Config } from 'openland-config/Config';
import { setLogProvider, LogPathContext, LogMetaContext } from '@openland/log';
import { Context, ContextName } from '@openland/context';
import winston from 'winston';
import pino from 'pino';
import { ZippedLoggerTimes } from '../openland-utils/ZippedLogger';

const isProduction = Config.environment === 'production';

import APM from 'elastic-apm-node';
const apm = APM.start({
    serverUrl: Config.apm?.endpoint || '',
    active: isProduction
});

const getPino = () => {
    let log = pino();
    log.level = 'debug';
    return log;
};

const format = isProduction ?
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

export const logger = isProduction ? getPino() : winston.createLogger({
    level: 'debug',
    format: format,
    transports: [
        new winston.transports.Console(),
    ]
});

function formatMessage(ctx: Context, name: string, message: string) {
    if (isProduction) {
        let v = LogPathContext.get(ctx);
        return ContextName.get(ctx) + ' | ' + [...v, name].join(' ➾ ') + ': ' + message;
    } else {
        return name + ': ' + message;
    }
}

setLogProvider({
    log: (ctx, service, level, message) => {
        let obj: any;
        if (isProduction) {
            obj = {
                app: {
                    ...LogMetaContext.get(ctx),
                    parent: LogPathContext.get(ctx),
                    context: ContextName.get(ctx),
                    service,
                    text: message,
                    times: ZippedLoggerTimes.get(ctx),
                },
                message: formatMessage(ctx, service, message)
            };
        } else {
            obj = formatMessage(ctx, service, message);
        }
        if (level === 'debug') {
            logger.debug(obj);
        } else if (level === 'error') {
            logger.error(obj);
            apm.captureError(obj, { handled: false });
        } else if (level === 'warn') {
            logger.warn(obj);
            apm.captureError(obj, { handled: true });
        } else {
            logger.info(obj);
        }
    },
    metric: (ctx: Context, service, name, value, dimension) => {
        if (isProduction) {
            logger.info({
                app: {
                    ...LogMetaContext.get(ctx),
                    parent: LogPathContext.get(ctx),
                    context: ContextName.get(ctx),
                    service,
                    text: name,
                    metric: value
                },
                message: formatMessage(ctx, service, name + ': ' + value + ' ' + dimension)
            });
        } else {
            logger.info(formatMessage(ctx, service, name + ': ' + value + ' ' + dimension));
        }
    }
});