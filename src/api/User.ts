import { DB, User } from '../tables';
import { CallContext } from './CallContext';
import { IDs } from './utils/IDs';
import { UserProfile } from '../tables/UserProfile';
import * as DataLoader from 'dataloader';

function userLoader(context: CallContext) {
    if (!context.cache.has('__profile_loader')) {
        context.cache.set('__profile_loader', new DataLoader<number, UserProfile | null>(async (ids) => {
            let foundTokens = await DB.UserProfile.findAll({
                where: {
                    userId: {
                        $in: ids
                    }
                }
            });

            let res: (UserProfile | null)[] = [];
            for (let i of ids) {
                let found = false;
                for (let f of foundTokens) {
                    if (i === f.userId) {
                        res.push(f);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    res.push(null);
                }
            }
            return res;
        }));
    }
    let loader = context.cache.get('__profile_loader') as DataLoader<number, UserProfile | null>;
    return loader;
}

function withProfile(handler: (user: User, profile: UserProfile) => any) {
    return async (src: User, _params: {}, context: CallContext) => {
        let loader = userLoader(context);
        let profile = await loader.load(src.id!!);
        if (!profile) {
            throw Error('Profile not present');
        }
        return handler(src, profile);
    };
}

export const Resolver = {
    User: {
        id: (src: User) => IDs.User.serialize(src.id!!),
        name: withProfile((src, profile) => [profile.firstName, profile.lastName].filter((v) => !!v).join(' ')),
        firstName: withProfile((src, profile) => profile.firstName),
        lastName: withProfile((src, profile) => profile.lastName),
        picture: withProfile((src, profile) => profile.picture),
        email: (src: User) => src.email,
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid
    },
    Query: {
        me: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            } else {
                let profile = await userLoader(context).load(context.uid);
                if (profile === null) {
                    return null;
                }
                return DB.User.findById(context.uid);
            }
        }
    }
};