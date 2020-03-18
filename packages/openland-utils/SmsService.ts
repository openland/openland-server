import Twilio from 'twilio';

const OUT_NUMBER = '+14152134985';

interface ISmsService {
    sendSms(to: string, body: string): Promise<boolean>;
}

class SmsServiceImpl implements ISmsService {
    private twillioApi = Twilio('ACda0e12713c484afa48c2d11231ce079d', 'fab22e6e4f2569763435147238036da4');

    async sendSms(to: string, body: string) {
        await this.twillioApi.messages.create({ body, to, from: OUT_NUMBER});
        return true;
    }
}

export const SmsService = new SmsServiceImpl();
