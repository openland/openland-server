import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { FolderItemAttributes } from '../tables/FolderItem';
import { ElasticClient } from '../indexing';
import { QueryParser, buildElasticQuery } from '../modules/QueryParser';

export class FoldersRepository {
    private parser = new QueryParser();
    async setFolder(orgId: number, parcelId: number, folderId?: number, transaction?: Transaction) {
        if (!folderId) {
            await DB.FolderItem.destroy({
                where: {
                    organizationId: orgId,
                    lotId: parcelId
                }
            });
        } else {
            let existing = await DB.FolderItem.find({
                where: {
                    organizationId: orgId,
                    lotId: parcelId,
                },
                transaction
            });

            if (existing === null) {
                await DB.FolderItem.create({
                    organizationId: orgId,
                    folderId: folderId,
                    lotId: parcelId
                }, { transaction });
            } else if (existing.folderId !== folderId) {
                existing.destroy({ transaction });
                await DB.FolderItem.create({
                    organizationId: orgId,
                    folderId: folderId,
                    lotId: parcelId!
                }, { transaction });
            }
        }
    }

    async setFolderBatch(orgId: number, parcels: number[], tx: Transaction, folderId?: number) {

        let workingSet = parcels;
        while (workingSet.length > 0) {
            let ids: number[] = [];
            const batchSize = 1000;
            if (workingSet.length < batchSize) {
                ids = workingSet;
                workingSet = [];
            } else {
                ids = workingSet.slice(0, batchSize);
                workingSet = workingSet.slice(batchSize);
            }

            if (!folderId) {
                await DB.FolderItem.destroy({
                    where: {
                        organizationId: orgId,
                        lotId: {
                            $in: ids
                        }
                    },
                    transaction: tx
                });
            } else {
                let existing = await DB.FolderItem.findAll({
                    where: {
                        organizationId: orgId,
                        lotId: {
                            $in: ids
                        }
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });

                let toCreate: FolderItemAttributes[] = [];
                let toDestroy: number[] = [];
                for (let i of ids) {
                    if (existing.find((v) => v.lotId === i)) {
                        toDestroy.push(i);
                    }
                    toCreate.push({
                        organizationId: orgId,
                        folderId: folderId,
                        lotId: i!
                    });
                }

                if (toCreate.length > 0) {
                    await DB.FolderItem.destroy({
                        where: {
                            lotId: {
                                $in: toDestroy
                            }
                        },
                        transaction: tx
                    });
                }

                if (toCreate.length > 0) {
                    await DB.FolderItem.bulkCreate(toCreate, { transaction: tx });
                }
            }

        }
    }

    async destroyFolder(folderId: number, organizationId: number) {
        await DB.tx(async (tx) => {
            let folder = await DB.Folder.find({
                where: { organizationId: organizationId, id: folderId },
                lock: tx.LOCK.UPDATE,
                transaction: tx
            });
            await DB.FolderItem.destroy({
                where: {
                    organizationId: organizationId,
                    id: folderId
                },
                transaction: tx
            });
            if (!folder) {
                throw Error('Unable to find folder');
            }
            await folder.destroy({ transaction: tx });
        });
    }

    async fetchGeoFolderItems(organization: number, box: { south: number, north: number, east: number, west: number }, limit: number, query: string | null) {
        let clauses: any[] = [{ term: { orgId: organization } }];
        if (query) {
            clauses.push(buildElasticQuery(this.parser.parseQuery(query)));
        }
        let hits = await ElasticClient.search({
            index: 'folders',
            type: 'folder',
            size: limit,
            from: 0,
            body: {
                query: {
                    bool: {
                        must: clauses,
                        filter: {
                            bool: {
                                must: [
                                    {
                                        geo_shape: {
                                            geometry: {
                                                shape: {
                                                    type: 'envelope',
                                                    coordinates:
                                                        [[box.west, box.south],
                                                        [box.east, box.north]],
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        });

        let res = await DB.FolderItem.findAll({
            where: {
                id: {
                    $in: hits.hits.hits.map((v) => v._id)
                }
            },
            include: [{
                model: DB.Lot,
                as: 'lot'
            }]
        });
        return res;
    }
}
