import { withAccount, withAny } from './utils/Resolvers';
import { Repos } from '../repositories';
import { UserError } from '../errors/UserError';

export const Resolvers = {
    Mutation: {
        alphaPhoneSendCode: withAccount<{ phoneNumber: string }>(async (args, uid) => {
            if (!Repos.Phones.checkPhone(args.phoneNumber)) {
                throw new UserError('Invalid phone');
            }

            await Repos.Phones.sendCode(args.phoneNumber);

            return 'ok';
        }),
        alphaPhoneVerify: withAccount<{ phoneNumber: string, code: string }>(async (args, uid) => {
            if (!Repos.Phones.checkPhone(args.phoneNumber)) {
                throw new UserError('Invalid phone');
            }

            await Repos.Phones.authVerify(uid, args.phoneNumber, args.code);

            return 'ok';
        }),

        alphaPhoneSendAuthCode: withAny<{ phoneNumber: string }>(async (args, uid) => {
            if (!Repos.Phones.checkPhone(args.phoneNumber)) {
                throw new UserError('Invalid phone');
            }

            await Repos.Phones.sendCode(args.phoneNumber, true);

            return 'ok';
        }),
        alphaPhoneAuth: withAny<{ phoneNumber: string, code: string }>(async (args, uid) => {
            if (!Repos.Phones.checkPhone(args.phoneNumber)) {
                throw new UserError('Invalid phone');
            }

            let token = await Repos.Phones.authPhone(args.phoneNumber, args.code);

            return {
                token
            };
        }),
    }
};