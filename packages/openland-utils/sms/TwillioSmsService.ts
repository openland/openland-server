import { createLogger } from '@openland/log';
import { ISmsService } from './ISmsService';
import Twilio from 'twilio';
import { Context } from '@openland/context';
import { Events } from '../../openland-module-hyperlog/Events';
import { createTracer } from 'openland-log/createTracer';
import { inTx } from '@openland/foundationdb';

const OUT_NUMBER = '+14152134985';
const tracer = createTracer('twilio');
const logger = createLogger('twilio');
export class TwillioSmsService implements ISmsService {
    private twillioApi = Twilio(
        'ACda0e12713c484afa48c2d11231ce079d',
        'fab22e6e4f2569763435147238036da4'
    );

    async sendSms(parent: Context, to: string, body: string) {
        try {
            return await tracer.trace(parent, 'send-sms', async (ctx) => {
                await this.twillioApi.messages.create({ body, to, from: OUT_NUMBER });
                await inTx(ctx, async (ctx2) => {
                    Events.SmsSentEvent.event(ctx2, { phone: to });
                });
                return true;
            });
        } catch (e) {
            logger.warn(parent, 'Unable to send sms to ' + to);
            logger.warn(parent, e);
            throw e;
        }
    }
}