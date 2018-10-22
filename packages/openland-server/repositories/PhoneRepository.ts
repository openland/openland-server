import { randomString } from '../utils/random';
import { Services } from '../services';
import { DB } from '../tables';
import { UserError } from '../errors/UserError';
import { Modules } from 'openland-modules/Modules';

const PHONE_CODE_TTL = 1000 * 60;
const PHONE_CODE_LEN = 5;

export function isTestPhone(phone: string) {
    return phone.substr(0, 2) === '19';
}

export function getTestPhoneCode(phone: string) {
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

    async sendCode(phone: string, auth: boolean = false) {
        if (this.codes.haveCode(phone)) {
            throw new UserError('Code was sent already');
        }
        if (!auth && await DB.Phone.findOne({ where: { phone } })) {
            throw new UserError('Phone already registered');
        }
        let code = this.codes.genCode(phone);
        if (!isTestPhone(phone)) {
            await Services.TeleSign.sendSMS(phone, 'Your code: ' + code);
        }
    }

    async authVerify(uid: number, phone: string, code: string) {
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

    async authPhone(phone: string, code: string) {
        return DB.tx(async (tx) => {
            if (!this.codes.haveCode(phone)) {
                throw new UserError('No code was sent');
            }

            let isValid = this.codes.checkCode(phone, code);

            if (!isValid) {
                throw new UserError('Invalid code');
            }

            let existing = await DB.Phone.findOne({ where: { phone }, transaction: tx });

            if (existing) {
                return await Modules.Auth.createToken(existing.userId!);
            }

            let user = await DB.User.create({
                authId: 'phone|' + phone,
                email: '',
            }, { transaction: tx });

            await DB.Phone.create({
                phone,
                status: 'VERIFIED',
                userId: user.id
            }, { transaction: tx });

            return await Modules.Auth.createToken(user.id!);
        });
    }

    async getUserPhones(uid: number) {
        return (await DB.Phone.findAll({ where: { userId: uid, status: 'VERIFIED' }})).map(p => p.phone);
    }
}