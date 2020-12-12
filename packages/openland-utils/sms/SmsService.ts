import { Context } from '@openland/context';
import { ISmsService } from './ISmsService';
import { TwillioSmsService } from './TwillioSmsService';
import { SmscSmsService } from './SmscSmsService';
import { parsePhoneNumber } from 'libphonenumber-js';

const USE_SMSC_FOR_RUSSIA = true;

class SmsServiceImpl implements ISmsService {
    private twillioService = new TwillioSmsService();
    private smscService = new SmscSmsService();

    async sendSms(ctx: Context, to: string, body: string) {
        let phone = parsePhoneNumber(to);
        if (USE_SMSC_FOR_RUSSIA && phone.country === 'RU') {
            return await this.smscService.sendSms(ctx, phone.number.toString(), body);
        } else {
            return await this.twillioService.sendSms(ctx, phone.number.toString(), body);
        }
    }
}

export const SmsService = new SmsServiceImpl();
