import { withPermissionOptional, withUser } from './utils/Resolvers';
import { DB } from '../tables';
import { normalizeCapitalized } from '../modules/Normalizer';
import { IDs } from './utils/IDs';
import { delay } from '../utils/timer';
import { Emails } from '../services/Emails';

export const Resolver = {
    Query: {
        debugReaderStates: withPermissionOptional(['software-developer'], async () => {
            let readers = (await DB.ReaderState.findAll());
            return readers.map((v) => ({
                id: IDs.DebugReader.serialize(v.id!!),
                title: normalizeCapitalized(v.key!!.replace('_', ' ')),
                remaining: v.remaining
            }));
        })
    },
    Mutation: {
        debugSendWelcomeEmail: withUser(async (args, uid) => {
            await Emails.sendWelcomeEmail(uid);
            return 'ok';
        }),

        debugSendEmail: withPermissionOptional<{ email: string, text: string }>(['software-developer'], async (args) => {
            console.log(1223);
            await Emails.sendDebugEmail(args.email, args.text);

            return 'ok';
        })
    },
    Subscription: {
        lifecheck: {
            resolve: (root: any) => {
                // console.log('subscription server resolve', { root });
                return root;
            },
            subscribe: async function* g() {
                console.warn('start');
                while (true) {
                    yield new Date().toUTCString();
                    await delay(1000);
                }
            }
        }
    }
};