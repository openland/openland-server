// import { apm } from './../openland-log/apm';
import { Config } from 'openland-config/Config';
import { setLogProvider, LogPathContext, LogMetaContext } from '@openland/log';
import { Context, ContextName } from '@openland/context';
import winston from 'winston';
import pino from 'pino';
import { ZippedLoggerTimes } from '../openland-utils/ZippedLogger';

const isProduction = Config.environment === 'production';

const getPino = () => {
    let log = pino();
    log.level = 'info';
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

// function formatApmError(ctx: Context, service: string, message: string) {
//     return {
//         message: formatMessage(ctx, service, message),
//         params: {
//             context: ContextName.get(ctx),
//             parent: LogPathContext.get(ctx),
//             ...LogMetaContext.get(ctx),
//         },
//         name: service,
//     };
// }

setLogProvider({
    log: (ctx, service, level, message) => {
        // if (message.length > 512) {
        //     message = message.slice(0, 512) + '...';
        // }
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
            // apm.captureError(formatApmError(ctx, service, message), { labels: { level } });
        } else if (level === 'warn') {
            logger.warn(obj);
            // apm.captureError(formatApmError(ctx, service, message), { labels: { level } });

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