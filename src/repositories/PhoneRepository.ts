import { randomString } from '../utils/random';
import { Services } from '../services';
import { DB } from '../tables';
import { UserError } from '../errors/UserError';

const PHONE_CODE_TTL = 1000 * 60;
const PHONE_CODE_LEN = 5;

function isTestPhone(phone: string) {
    return phone.substr(0, 2) === '19';
}

function getTestPhoneCode(phone: string) {
    return phone.substr(-5);
}

class PhoneCodesService {
    private codes = new Map<string, { code: string }>();

    genCode(phone: string) {
        let code = randomString(PHONE_CODE_LEN);

        // testing phones
        if (isTestPhone(phone)) {
            code = getTestPhoneCode(phone);
        }

        this.codes.set(phone, { code });
        setTimeout(() => this.codes.delete(phone), PHONE_CODE_TTL);

        return code;
    }

    haveCode(phone: string) {
        return this.codes.has(phone);
    }

    checkCode(phone: string, code: string) {
        let isValid = this.codes.has(phone) && this.codes.get(phone)!.code === code;

        if (isValid) {
            this.codes.delete(phone);
        }

        return isValid;
    }

    delCode(phone: string) {
        this.codes.delete(phone);
    }
}

export class PhoneRepository {
    private codes = new PhoneCodesService();

    checkPhone(phone: string) {
        return /^[1-9](\d{10})$/.test(phone);
    }

    async sendCode(uid: number, phone: string) {
        let code = this.codes.genCode(phone);
        if (this.codes.haveCode(phone)) {
            throw new UserError('Code was sent already');
        }
        if (await DB.Phone.findOne({ where: { phone } })) {
            throw new UserError('Phone already registered');
        }
        if (!isTestPhone(phone)) {
            await Services.TeleSign.sendSMS(phone, 'Your code: ' + code);
        }
    }

    async authPhone(uid: number, phone: string, code: string) {
        if (!this.codes.haveCode(phone)) {
            throw new UserError('No code was sent');
        }

        let isValid = this.codes.checkCode(phone, code);

        if (isValid) {
            await DB.Phone.create({
                phone,
                status: 'VERIFIED',
                userId: uid
            });
        } else {
            throw new UserError('Invalid code');
        }
    }
}