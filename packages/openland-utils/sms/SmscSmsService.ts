import { ISmsService } from './ISmsService';
import { Context } from '@openland/context';
import { Events } from '../../openland-module-hyperlog/Events';
import fetch from 'node-fetch';

const USER = 'altox';
const PASSWORD = '8eVnYtVUcqcZaLC2pyFa';

export class SmscSmsService implements ISmsService {
    async sendSms(ctx: Context, to: string, body: string) {
        await fetch(encodeURI(`https://smsc.ru/sys/send.php?login=${USER}&psw=${PASSWORD}&phones=${to}&mes=${body}`), {
            method: 'POST'
        });
        Events.SmsSentEvent.event(ctx, { phone: to });
        return true;
    }
}