import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import { Store } from '../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../openland-modules/Modules';

class UserInfoBuilder {
    private info: { name: string, value: string }[] = [];

    add = (name: string, value: any) => this.info.push({ name, value: value.toString() });

    render = () => this.info;
}

export const Resolver: GQLResolver = {
    UserInfoTuple: {
        name: src => src.name,
        value: src => src.value
    },

    UserInfo: {
        user: src => src.uid,
        info: src => src.info
    },

    Query: {
        superUserInfo: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let uid = IDs.User.parse(args.uid);
                let user = await Store.User.findById(ctx, uid);
                if (!user) {
                    return null;
                }

                let info = new UserInfoBuilder();

                info.add('int-id', user.id);
                info.add('status', user.status);

                let superRole = await Modules.Super.superRole(ctx, uid);

                info.add('role', superRole || 'user');

                if (user.phone) {
                    info.add('auth-phone', user.phone);
                }
                if (user.email) {
                    info.add('auth-email', user.email);
                }

                let userWallet = await Modules.Wallet.getWallet(ctx, uid);
                let userSubscriptions = await Store.WalletSubscription.user.findAll(ctx, uid);
                let haveActiveSubscriptions = userSubscriptions.filter(s => s.state !== 'canceled').length > 0;

                info.add('wallet-id-locked', userWallet.isLocked);
                info.add('wallet-balance', userWallet.balance);
                info.add('wallet-failing-payments-count', await Modules.Wallet.getFailingPaymentsCount(ctx, uid));
                info.add('wallet-have-active-subscriptions', haveActiveSubscriptions);

                return {
                    uid,
                    info: info.render()
                };
            });
        })
    }
};