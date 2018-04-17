import { DB } from '../tables/index';
import { SelectBuilder } from '../modules/SelectBuilder';
import { OpportunityAttributes } from '../tables/Opportunity';

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
        return builder.findAll([{
            model: DB.Lot,
            as: 'lot',
            include: [{
                model: DB.StreetNumber,
                as: 'streetNumbers',
                include: [{
                    model: DB.Street,
                    as: 'street'
                }],
            }]
        }]);
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

    async fetchNext(organization: number, state: string, initialId?: number) {

        if (initialId !== undefined) {
            let initialOpportunity = await DB.Opportunities.find({
                where: {
                    id: initialId,
                    organizationId: organization,
                    state: state
                }
            });
            if (initialOpportunity) {
                return initialOpportunity;
            }
        }

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

    async addOpportunityBatch(organizationId: number, parcels: number[]) {
        let workingSet = parcels;
        while (workingSet.length > 0) {
            let ids: number[] = [];
            if (workingSet.length < 1000) {
                ids = workingSet;
                workingSet = [];
            } else {
                ids = workingSet.slice(0, 1000);
                workingSet = workingSet.slice(1000);
            }

            await DB.tx(async (tx) => {
                let ex = await DB.Opportunities.findAll({
                    where: {
                        organizationId: organizationId,
                        lotId: {
                            $in: ids
                        }
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });
                let pending: OpportunityAttributes[] = [];
                for (let i of ids) {
                    if (ex.find((v) => v.lotId === i)) {
                        continue;
                    }
                    pending.push({
                        organizationId: organizationId,
                        lotId: i
                    });
                }
                if (pending.length > 0) {
                    await DB.Opportunities.bulkCreate(pending);
                }
            });
        }
    }
}