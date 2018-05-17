import { withAccount, withAccountTypeOptional } from './utils/Resolvers';
import { Folder } from '../tables/Folder';
import { IDs } from './utils/IDs';
import { DB, Lot } from '../tables';
import { Repos } from '../repositories';
import { ElasticClient } from '../indexing';

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
        parcelsCount: withAccountTypeOptional<Folder | 'favorites' | 'all'>(async (src, uid, orgId) => {
            switch (src) {
                case 'favorites':
                    return uid ? await Repos.Parcels.fetchFavoritesCount(uid) : 0;
                case 'all':
                    return 0;
                default:
                    return (await DB.FolderItem.findAll({
                        where: {
                            folderId: src.id!!,
                            organizationId: orgId
                        },
                        include: [{
                            model: DB.Lot,
                            as: 'lot'
                        }]
                    })).length;
            }
        }),
        parcels: withAccountTypeOptional<Folder | 'favorites' | 'all'>(async (src, uid, orgId) => {
            switch (src) {
                case 'favorites':
                    let favorites = uid ? await Repos.Parcels.fetchFavorites(uid) : [];
                    return {
                        edges: favorites.map((v) => ({ node: v, cursor: v.id })),
                        pageInfo: {
                            hasNextPage: false,
                            hasPreviousPage: false,
                            itemsCount: favorites.length,
                            pagesCount: 0,
                            currentPage: 0,
                            openEnded: false,
                        }
                    };
                case 'all':
                    return {
                        edges: [],
                        pageInfo: {
                            hasNextPage: false,
                            hasPreviousPage: false,
                            itemsCount: 0,
                            pagesCount: 0,
                            currentPage: 0,
                            openEnded: false,
                        }
                    };
                default:
                    let lots = (await DB.FolderItem.findAll({
                        where: {
                            folderId: src.id!!,
                            organizationId: orgId
                        },
                        include: [{
                            model: DB.Lot,
                            as: 'lot'
                        }]
                    })).map((v) => v.lot!!);
                    //  src.id!!
                    return {
                        edges: lots.map((v) => ({ cursor: v.id, node: v })),
                        pageInfo: {
                            hasNextPage: false,
                            hasPreviousPage: false,
                            itemsCount: lots.length,
                            pagesCount: 0,
                            currentPage: 0,
                            openEnded: false,
                        }
                    };
            }
        })
    },
    Parcel: {
        folder: withAccountTypeOptional<Lot>(async (args, uid, orgId) => {
            if (orgId) {
                let folder = await DB.FolderItem.findOne({
                    where: {
                        lotId: args.id!!,
                        organizationId: orgId
                    }
                });
                if (folder) {
                    return await DB.Folder.findById(folder.folderId!!);
                }
            }
            return null;
        })
    },
    SearchResult: {
        folders: withAccountTypeOptional<{ query: string }>(async (args, uid, orgId) => {
            let hits = await ElasticClient.search({
                index: 'folders',
                type: 'folder',
                size: 10,
                from: 0,
                body: {
                    query: {
                        bool: {
                            must: { match: 'orgId', value: orgId },
                            should: [
                                { term: { 'name': { value: args.query, boost: 40.0 } } },
                            ]
                        }
                    },
                    highlight: {
                        fields: {
                            displayId: {},
                            addressRaw: {}
                        }
                    }
                }
            });
            let edges = [];
            for (let hit of hits.hits.hits) {
                let lt = await DB.Folder.findById(parseInt(hit._id, 10));
                if (lt) {
                    let highlights = [];
                    if (hit.highlight) {
                        if (hit.highlight.name) {
                            highlights.push({ key: 'name', match: hit.highlight.name });
                        }
                    }
                    edges.push({
                        score: hit._score,
                        highlight: highlights,
                        node: lt
                    });
                }
            }
            return {
                edges,
                total: hits.hits.total
            };
        }),
    },
    Query: {
        alphaFolders: withAccount(async (args, uid, orgId) => {
            let res: (Folder | 'favorites' | 'all')[] = [];
            // res.push('all');
            let folders = await DB.Folder.findAll({
                where: {
                    organizationId: orgId
                }
            });
            folders = folders.sort((a, b) => a.name!!.localeCompare(b.name!!));
            res = [...res, ...folders];
            // res.push('favorites');
            return res;
        }),
        alphaFolder: withAccount<{ id: string }>(async (args, uid, orgId) => {
            if (args.id === 'favorites') {
                return 'favorites';
            } else if (args.id === 'all') {
                return 'all';
            } else {
                let res = await DB.Folder.find({
                    where: {
                        organizationId: orgId,
                        id: IDs.Folder.parse(args.id)
                    }
                });

                if (!res) {
                    throw Error('Unable to find folder');
                }

                return res;
            }
        })
    },
    Mutation: {
        alphaCreateFolder: withAccount<{ name: string, initialParcels?: [string] }>(async (args, uid, orgId) => {
            let name = args.name.trim();
            if (name === '') {
                throw Error('Name can\'t be empty');
            }

            return await DB.tx(async (tx) => {
                let folder = await DB.Folder.create({
                    name: name,
                    organizationId: orgId,
                });
                if (args.initialParcels) {
                    for (let parcelId of args.initialParcels) {
                        let parcel = await Repos.Parcels.fetchParcelByRawMapId(parcelId);
                        if (!parcel) {
                            throw Error('Unable to find parcel');
                        }
                        await Repos.Folders.setFolder(orgId, parcel.id!!, folder.id!!, tx);
                    }
                }
                return folder;
            });
        }),
        alphaAlterFolder: withAccount<{ folderId: string, name: string }>(async (args, uid, orgId) => {
           
            let folder = await DB.Folder.find({ where: { organizationId: orgId, id: IDs.Folder.parse(args.folderId) } });
            if (!folder) {
                throw Error('Unable to find folder');
            }

            if (args.name !== undefined) {
                if (args.name === null || args.name.trim() === '') {
                    throw Error('Name can\'t be empty');
                }
                
                folder.name = args.name.trim();
            }

            await folder.save();

            return folder;
        }),
        alphaParcelAddToFolder: withAccount<{ folderId: string, parcelId: string }>(async (args, uid, orgId) => {
            let folder = await DB.Folder.find({ where: { organizationId: orgId, id: IDs.Folder.parse(args.folderId) } });
            if (!folder) {
                throw Error('Unable to find folder');
            }
            let parcel = await Repos.Parcels.fetchParcelByRawMapId(args.parcelId);
            if (!parcel) {
                throw Error('Unable to find parcel');
            }

            await DB.FolderItem.create({
                organizationId: orgId,
                folderId: folder.id!!,
                lotId: parcel.id!!
            });

            return parcel;
        }),
        alphaParcelSetFolder: withAccount<{ folderId?: string | null, parcelId: string }>(async (args, uid, orgId) => {
            let parcel = await Repos.Parcels.fetchParcelByRawMapId(args.parcelId);
            if (!parcel) {
                throw Error('Unable to find folder');
            }

            if (!args.folderId) {
                await Repos.Folders.setFolder(orgId, parcel.id!!);
            } else {
                await DB.tx(async (tx) => {
                    let folder = await DB.Folder.find({ where: { organizationId: orgId, id: IDs.Folder.parse(args.folderId!!) } });
                    if (!folder) {
                        throw Error('Unable to find folder');
                    }
                    await Repos.Folders.setFolder(orgId, parcel!!.id!!, folder.id!!, tx);
                });
            }
            return parcel;
        }),
    }
};