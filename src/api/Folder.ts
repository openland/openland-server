import { withAccount } from './utils/Resolvers';
import { Folder } from '../tables/Folder';
import { IDs } from './utils/IDs';
import { DB } from '../tables';

export const Resolver = {
    Folder: {
        id: (src: Folder | 'favorites' | 'all') => {
            switch (src) {
                case 'favorites':
                    return 'favorites';
                case 'all':
                    return 'all';
                default:
                    return IDs.Folder.serialize(src.id!!);
            }
        },
        name: (src: Folder | 'favorites' | 'all') => {
            switch (src) {
                case 'favorites':
                    return 'Favorites';
                case 'all':
                    return 'All Parcels';
                default:
                    return src.name;
            }
        },
        special: (src: Folder | 'favorites' | 'all') => {
            switch (src) {
                case 'favorites':
                    return 'FAVORITES';
                case 'all':
                    return 'ALL';
                default:
                    return null;
            }
        },
    },
    Query: {
        alphaFolders: withAccount(async (args, uid, orgId) => {
            let res: (Folder | 'favorites' | 'all')[] = [];
            res.push('all');
            res.push('favorites');
            let folders = await DB.Folder.findAll({
                where: {
                    organizationId: orgId
                }
            });
            folders = folders.sort((a, b) => a.name!!.localeCompare(b.name!!));
            res = [...res, ...folders];
            return res;
        })
    }
};