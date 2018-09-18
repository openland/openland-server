import { withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { UserError } from '../errors/UserError';

export const Resolvers = {
    Mutation: {
        alphaPhoneSendCode: withAccount<{ phoneNumber: string }>(async (args, uid) => {
            if (!Repos.Phones.checkPhone(args.phoneNumber)) {
                throw new UserError('Invalid phone');
            }

            await Repos.Phones.sendCode(uid, args.phoneNumber);

            return 'ok';
        }),
        alphaPhoneVerify: withAccount<{ phoneNumber: string, code: string }>(async (args, uid) => {
            if (!Repos.Phones.checkPhone(args.phoneNumber)) {
                throw new UserError('Invalid phone');
            }

            await Repos.Phones.authPhone(uid, args.phoneNumber, args.code);

            return 'ok';
        }),
    }
};