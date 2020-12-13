import { ISmsService } from './ISmsService';
import Twilio from 'twilio';
import { Context } from '@openland/context';
import { Events } from '../../openland-module-hyperlog/Events';

const OUT_NUMBER = '+14152134985';

export class TwillioSmsService implements ISmsService {
    private twillioApi = Twilio(
        'ACda0e12713c484afa48c2d11231ce079d',
        'fab22e6e4f2569763435147238036da4'
    );

    async sendSms(ctx: Context, to: string, body: string) {
        await this.twillioApi.messages.create({ body, to, from: OUT_NUMBER});
        Events.SmsSentEvent.event(ctx, { phone: to });
        return true;
    }
}