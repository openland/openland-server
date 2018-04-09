import { DB } from '../tables/index';
import { SelectBuilder } from '../modules/SelectBuilder';

export class OpportunitiesRepository {
    fetchConnection(organization: number, first: number, state?: string, after?: string, page?: number) {
        let builder = new SelectBuilder(DB.Opportunities)
            .limit(first)
            .after(after)
            .page(page)
            .whereEq('organizationId', organization)
            .orderBy('id', 'DESC');
        if (state) {
            builder = builder.whereEq('state', state);
        }
        return builder.findAll();
    }

    fetchConnectionCount(organization: number, state?: string) {
        let builder = new SelectBuilder(DB.Opportunities)
            .whereEq('organizationId', organization)
            .orderBy('id', 'DESC');
        if (state) {
            builder = builder.whereEq('state', state);
        }
        return builder.count();
    }

    async fetchNext(organization: number, state: string) {
        let builder = new SelectBuilder(DB.Opportunities)
            .limit(1)
            .whereEq('organizationId', organization)
            .whereEq('state', state)
            .orderBy('id', 'DESC');

        let res = await builder.findAllDirect();
        if (res.length > 0) {
            return res[0];
        } else {
            return null;
        }
    }

    findOpportunity(organizationId: number, parcelId: number) {
        return DB.Opportunities.findOne({
            where: {
                organizationId: organizationId,
                lotId: parcelId
            }
        });
    }

    findOpportunityById(organizationId: number, opportunityId: number) {
        return DB.Opportunities.findOne({
            where: {
                id: opportunityId,
                organizationId: organizationId
            }
        });
    }

    async approveOpportunity(organizationId: number, opportunityId: number, state: string) {
        return DB.tx(async (tx) => {
            let op = await DB.Opportunities.findOne({
                where: {
                    id: opportunityId,
                    organizationId: organizationId,
                    state: state
                },
                lock: tx.LOCK.UPDATE,
                transaction: tx
            });
            if (!op) {
                throw Error('Unable to find opportunity');
            }
            if (state === 'INCOMING' && op.state === 'INCOMING') {
                op.state = 'APPROVED_INITIAL';
                await op.save({ transaction: tx });
            } else if (state === 'APPROVED_INITIAL' && op.state === 'APPROVED_INITIAL') {
                op.state = 'APPROVED_ZONING';
                await op.save({ transaction: tx });
            } else if (state === 'APPROVED_ZONING' && op.state === 'APPROVED_ZONING') {
                op.state = 'APPROVED';
                await op.save({ transaction: tx });
            }
            return op;
        });
    }

    async rejectOpportunity(organizationId: number, opportunityId: number, state: string) {
        return DB.tx(async (tx) => {
            let op = await DB.Opportunities.findOne({
                where: {
                    id: opportunityId,
                    organizationId: organizationId,
                },
                lock: tx.LOCK.UPDATE,
                transaction: tx
            });
            if (!op) {
                throw Error('Unable to find opportunity');
            }
            if (state === op.state) {
                op.state = 'REJECTED';
                await op.save({ transaction: tx });
            }
            return op;
        });
    }

    async snoozeOpportunity(organizationId: number, opportunityId: number, state: string) {
        return DB.tx(async (tx) => {
            let op = await DB.Opportunities.findOne({
                where: {
                    id: opportunityId,
                    organizationId: organizationId,
                },
                lock: tx.LOCK.UPDATE,
                transaction: tx
            });
            if (!op) {
                throw Error('Unable to find opportunity');
            }
            if (state === op.state) {
                op.state = 'SNOOZED';
                await op.save({ transaction: tx });
            }
            return op;
        });
    }

    async addOpportunity(organizationId: number, parcelId: number) {
        return DB.tx(async (tx) => {
            let ex = await DB.Opportunities.findOne({
                where: {
                    organizationId: organizationId,
                    lotId: parcelId
                },
                lock: tx.LOCK.UPDATE,
                transaction: tx
            });
            if (ex != null) {
                return ex;
            }
            return await DB.Opportunities.create({
                organizationId: organizationId,
                lotId: parcelId
            }, { transaction: tx });
        });
    }
}