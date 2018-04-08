import { DB } from '../tables/index';
import { SelectBuilder } from '../modules/SelectBuilder';

export class OpportunitiesRepository {
    fetchConnection(organization: number, first: number, after?: string, page?: number) {
        let builder = new SelectBuilder(DB.Opportunities)
            .limit(first)
            .after(after)
            .page(page)
            .whereEq('organizationId', organization)
            .orderBy('id', 'DESC');
        return builder.findAll();
    }

    findOpportunity(organizationId: number, parcelId: number) {
        return DB.Opportunities.findOne({
            where: {
                organizationId: organizationId,
                lotId: parcelId
            }
        });
    }

    async addOpportunity(organizationId: number, parcelId: number) {
        return DB.tx(async (tx) => {
            let ex = await DB.Opportunities.findOne({
                where: {
                    organizationId: organizationId,
                    lotId: parcelId
                },
                lock: tx.LOCK.UPDATE
            });
            if (ex != null) {
                return ex;
            }
            return await DB.Opportunities.create({
                organizationId: organizationId,
                lotId: parcelId
            });
        });
    }
}