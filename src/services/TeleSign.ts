import TeleSignSDK from 'telesignsdk';

export class TeleSign {
    private client = new TeleSignSDK(
        '05A641AD-6A27-44C4-98F4-7AA79339F2F3',
        'aTcckxONYt1rO2/FmwqaKG7qlgDwsUY8mUPA2w9Eu+s49yguJLfWsd2J/rGFg8O0zcQNBJjM0b3EwH/Pj5VgUw==',
        'https://rest-api.telesign.com',
        10 * 1000
    );

    sendSMS(phone: string, text: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.sms.message(
                (err, response) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(response);
                },
                phone,
                text,
                'ARN'
            );
        });
    }

    smsStatus(referenceId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.sms.status(
                (err, response) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(response);
                },
                referenceId
            );
        });
    }
}