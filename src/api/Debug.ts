import { withPermissionOptional } from './utils/Resolvers';
import { DB } from '../tables';
import { normalizeCapitalized } from '../modules/Normalizer';
import { IDs } from './utils/IDs';
import { delay } from '../utils/timer';

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