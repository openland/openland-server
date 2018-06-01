import { withAccount, withAccountTypeOptional } from './utils/Resolvers';
import { Folder } from '../tables/Folder';
import { IDs } from './utils/IDs';
import { DB, Lot } from '../tables';
import { Repos } from '../repositories';
import { ElasticClient } from '../indexing';
import { SelectBuilder } from '../modules/SelectBuilder';
import { FolderItem } from '../tables/FolderItem';
import * as Turf from '@turf/turf';
import { FoldeExportWorker } from '../workers';

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
                    return (await DB.FolderItem.findAndCountAll({
                        where: {
                            folderId: src.id!!,
                            organizationId: orgId!!
                        }
                    }));
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
    FolderItem: {
        id: (src: FolderItem) => IDs.FolderItem.serialize(src.id!!),
        parcel: (src: FolderItem) => {
            if (src.lot) {
                return src.lot;
            } else {
                return src.getLot();
            }
        },
        center: async (src: FolderItem) => {
            let lot = src.lot ? src.lot : (await src.getLot())!!;
            if (lot && lot.geometry) {
                let ctr = Turf.centerOfMass({ type: 'MultiPolygon', coordinates: lot.geometry.polygons.map((v) => [v.coordinates.map((v2) => [v2.longitude, v2.latitude])]) });
                return { longitude: ctr.geometry!!.coordinates[0], latitude: ctr.geometry!!.coordinates[1] };
            }
            return null;
        },
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
                            must: [
                                { term: { 'retired': false } },
                                { term: { 'orgId': orgId } },
                                { match: { 'name': args.query } }
                            ]
                        }
                    },
                    highlight: {
                        fields: {
                            name: {},
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
        }),
        alphaFolderItems: withAccount<{ folderId: string, first: number, after?: string, page?: number }>(async (args, uid, orgId) => {
            let folderId = IDs.Folder.parse(args.folderId);
            let builder = new SelectBuilder(DB.FolderItem)
                .whereEq('folderId', folderId)
                .whereEq('organizationId', orgId)
                .orderBy('createdAt')
                .after(args.after)
                .page(args.page)
                .limit(args.first);
            return builder.findAll([{ model: DB.Lot, as: 'lot' }]);
        }),
        alphaFolderItemsOverlay: withAccount<{ folderId: string, box: { south: number, north: number, east: number, west: number }, limit: number }>((args, uid, orgId) => {
            return Repos.Folders.fetchGeoFolderItems(orgId, args.box, args.limit, IDs.Folder.parse(args.folderId));
        }),
    },
    Mutation: {
        alphaCreateFolder: withAccount<{ name: string, initialParcels?: [string] }>(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                return await Repos.Folders.createFolder(orgId, args.name, tx, args.initialParcels);
            });
        }),
        alphaAlterFolder: withAccount<{ folderId: string, name: string }>(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                let folder = await DB.Folder.find({
                    where: {
                        organizationId: orgId,
                        id: IDs.Folder.parse(args.folderId)
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });
                if (!folder) {
                    throw Error('Unable to find folder');
                }

                if (args.name !== undefined) {
                    if (args.name === null || args.name.trim() === '') {
                        throw Error('Name can\'t be empty');
                    }

                    folder.name = args.name.trim();
                }

                await folder.save({ transaction: tx });
                return folder;

            });
        }),
        alphaDeleteFolder: withAccount<{ folderId: string }>(async (args, uid, orgId) => {
            await Repos.Folders.destroyFolder(IDs.Folder.parse(args.folderId), orgId);
            return 'ok';
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
                    let folder = await DB.Folder.find({
                        where:
                            {
                                organizationId: orgId,
                                id: IDs.Folder.parse(args.folderId!!)
                            },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (!folder) {
                        throw Error('Unable to find folder');
                    }
                    await Repos.Folders.setFolder(orgId, parcel!!.id!!, folder.id!!, tx);
                });
            }
            return parcel;
        }),
        alphaAddToFolderFromSearch: withAccount<{ folderId: string, state: string, county: string, city: string, query: string }>(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                let cityid = await Repos.Area.resolveCity(args.state, args.county, args.city);
                let parcels = await Repos.Parcels.fetchAllParcels(cityid, args.query);
                await Repos.Folders.setFolderBatch(orgId, parcels, tx, IDs.Folder.parse(args.folderId!!));
                return parcels.length;
            });
        }),
        alphaCreateFolderFromSearch: withAccount<{ name: string, state: string, county: string, city: string, query: string }>(async (args, uid, orgId) => {
            let name = args.name.trim();
            if (name === '') {
                throw Error('Name can\'t be empty');
            }
            let cityid = await Repos.Area.resolveCity(args.state, args.county, args.city);
            let parcels = await Repos.Parcels.fetchAllParcels(cityid, args.query);
            return await DB.tx(async (tx) => {
                let folder = await DB.Folder.create({
                    name: name,
                    organizationId: orgId,
                }, { transaction: tx });
                await Repos.Folders.setFolderBatch(orgId, parcels, tx, folder.id);
                return folder;
            });
        }),
        alphaExportFolder: withAccount<{ folderId: string }>(async (args, uid, orgId) => {
            let id = IDs.Folder.parse(args.folderId);

            let folder = await DB.Folder.find({
                where: {
                    organizationId: orgId,
                    id: id
                },
            });
            if (!folder) {
                throw Error('Unable to find folder');
            }

            return FoldeExportWorker.pushWork({ folderId: id });
        }),
    }
};