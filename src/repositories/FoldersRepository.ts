import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { FolderItemAttributes } from '../tables/FolderItem';

export class FoldersRepository {
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

}
