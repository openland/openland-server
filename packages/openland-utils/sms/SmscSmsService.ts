import { ISmsService } from './ISmsService';
import { Context } from '@openland/context';
import { Events } from '../../openland-module-hyperlog/Events';
import fetch from 'node-fetch';
import { createTracer } from 'openland-log/createTracer';

const USER = 'altox';
const PASSWORD = '8eVnYtVUcqcZaLC2pyFa';
const trace = createTracer('smsc');

export class SmscSmsService implements ISmsService {
    async sendSms(parent: Context, to: string, body: string) {
        return await trace.trace(parent, 'send-sms', async (ctx) => {
            await fetch(encodeURI(`https://smsc.ru/sys/send.php?login=${USER}&psw=${PASSWORD}&phones=${to}&mes=${body}`), {
                method: 'POST'
            });
            Events.SmsSentEvent.event(ctx, { phone: to });
            return true;
        });
    }
}