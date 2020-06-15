import Twilio from 'twilio';
import loggers from '../openland-module-hyperlog/loggers';
import { Context } from '@openland/context';

const OUT_NUMBER = '+14152134985';

interface ISmsService {
    sendSms(сtx: Context, to: string, body: string): Promise<boolean>;
}

class SmsServiceImpl implements ISmsService {
    private twillioApi = Twilio('ACda0e12713c484afa48c2d11231ce079d', 'fab22e6e4f2569763435147238036da4');

    async sendSms(ctx: Context, to: string, body: string) {
        await this.twillioApi.messages.create({ body, to, from: OUT_NUMBER});

        loggers.SmsSentEvent.event(ctx, { phone: to });
        return true;
    }
}

export const SmsService = new SmsServiceImpl();
