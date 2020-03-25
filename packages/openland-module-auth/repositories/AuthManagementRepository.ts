import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';

type AuthInfo = { type: 'email', email: string };

@injectable()
export class AuthManagementRepository {
    async getUserAuthInfo(parent: Context, uid: number) {
        return await inTx(parent, async ctx => {
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }

            let authInfo: AuthInfo[] = [];

            if (user.email) {
                authInfo.push({type: 'email', email: user.email});
            }

            return user.email;
        });
    }

    //
    // Email
    //
    async pairEmail(parent: Context, uid: number, email: string) {
        return await inTx(parent, async ctx => {
            email = email.trim().toLowerCase();
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }
            if (user.email) {
                throw new UserError(`You already have email`);
            }
            let existing = await Store.User.email.find(ctx, email);
            if (existing) {
                throw new UserError('This email already used');
            }
            user.email = email;
            await user.flush(ctx);
        });
    }

    async changeEmail(parent: Context, uid: number, newEmail: string) {
        return await inTx(parent, async ctx => {
            newEmail = newEmail.trim().toLowerCase();
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }
            if (!user.email) {
                throw new UserError(`You don't have email yet`);
            }
            let existing = await Store.User.email.find(ctx, newEmail);
            if (existing) {
                throw new UserError('This email already used');
            }
            user.email = newEmail;
            await user.flush(ctx);
        });
    }

    //
    // Phone
    //
    async pairPhone(parent: Context, uid: number, phone: string) {
        return await inTx(parent, async ctx => {
            phone = phone.trim();
            if (!/^\+[1-9]{1}[0-9]{3,14}$/.test(phone)) {
                throw new UserError('Invalid phone');
            }
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }
            if (user.phone) {
                throw new UserError(`You already have phone`);
            }
            let existing = await Store.User.phone.find(ctx, phone);
            if (existing) {
                throw new UserError('This email already used');
            }
            user.phone = phone;
            await user.flush(ctx);
        });
    }
}
