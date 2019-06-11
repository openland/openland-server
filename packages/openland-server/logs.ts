import { setLogProvider } from '@openland/log';
import { Context, ContextName } from '@openland/context';
import winston from 'winston';
import { SLogContext, SLogContext2 } from 'openland-log/src/SLogContext';

const isProduction = process.env.NODE_ENV === 'production';

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

const logger = winston.createLogger({
    level: 'debug',
    format: format,
    transports: [
        new winston.transports.Console(),
    ]
});

function formatMessage(ctx: Context, name: string, message: string) {
    let v = SLogContext.get(ctx);
    return ContextName.get(ctx) + ' | ' + [...v.path, name].join(' ') + ': ' + message;
}

setLogProvider({
    log: (ctx, service, level, message) => {
        let obj: any;
        if (isProduction) {
            obj = {
                app: {
                    ...SLogContext2.get(ctx),
                    context: ContextName.get(ctx),
                    service,
                    text: message
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
        } else if (level === 'warn') {
            logger.warn(obj);
        } else {
            logger.info(obj);
        }
    },
    metric: (ctx: Context, service, name, value, dimension) => {
        if (isProduction) {
            logger.info({
                app: {
                    ...SLogContext2.get(ctx),
                    context: ContextName.get(ctx),
                    service,
                    text: name + ': ' + value,
                    metric: value
                },
                message: name + ': ' + value
            });
        } else {
            logger.info(formatMessage(ctx, service, name + ': ' + value + ' ' + dimension));
        }
    }
});