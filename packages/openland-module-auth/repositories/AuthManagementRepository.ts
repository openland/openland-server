import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';

@injectable()
export class AuthManagementRepository {
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
            let existing = await Store.User.email.find(ctx, email);
            if (existing) {
                throw new UserError('This email already used');
            }
            user.email = email;
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
            let existing = await Store.User.fromPhone.find(ctx, phone);
            if (existing) {
                throw new UserError('This phone already used');
            }
            user.phone = phone;
            await user.flush(ctx);
        });
    }
}
