import { withAccount } from './utils/Resolvers';

export const Resolver = {
    Query: {
        alphaFolders: withAccount(async (args, uid, orgId) => {
            // let readers = (await DB.ReaderState.findAll());
            // return readers.map((v) => ({
            //     id: IDs.DebugReader.serialize(v.id!!),
            //     title: normalizeCapitalized(v.key!!.replace('_', ' ')),
            //     remaining: v.remaining
            // }));
            return [];
        })
    }
};