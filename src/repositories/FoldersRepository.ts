import { DB } from '../tables';
import { Transaction } from 'sequelize';

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
}