import { DB } from '../tables/index';
import { SelectBuilder } from '../modules/SelectBuilder';
import { OpportunityAttributes } from '../tables/Opportunity';
import { ElasticClient } from '../indexing';
import { currentTime } from '../utils/timer';
import { QueryParser, buildElasticQuery } from '../modules/QueryParser';

type OpportunitySort = 'DATE_ADDED_DESC' | 'AREA_ASC' | 'AREA_DESC';
export class OpportunitiesRepository {
    private parser = new QueryParser();
    constructor() {
        this.parser.registerBoolean('isPublic', 'ownerPublic');
        this.parser.registerText('stage', 'state');
    }
    async fetchConnection(organization: number, sort: OpportunitySort | null, query: string | null, first: number, state?: string, after?: string, page?: number) {
        let clauses: any[] = [{ term: { orgId: organization } }];
        if (state) {
            clauses.push({ term: { state: state } });
        }
        if (query) {
            clauses.push(buildElasticQuery(this.parser.parseQuery(query)));
        }
        let essort: any[] = [{ 'updatedAt': { 'order': 'desc' } }, { '_id': { 'order': 'asc' } }];
        if (sort === 'AREA_ASC') {
            essort = [{ 'area': { 'order': 'asc' } }, { '_id': { 'order': 'asc' } }];
        } else if (sort === 'AREA_DESC') {
            essort = [{ 'area': { 'order': 'desc' } }, { '_id': { 'order': 'asc' } }];
        }
        let hits = await ElasticClient.search({
            index: 'prospecting',
            type: 'opportunity',
            size: first,
            from: page ? ((page - 1) * first) : 0,
            body: {
                query: {
                    bool: {
                        must: clauses
                    }
                },
                sort: essort
            }
        });
        let builder = new SelectBuilder(DB.Opportunities)
            .limit(first)
            .after(after)
            .page(page);
        return await builder.findElastic(hits, [{
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

    async geoSearch(organization: number, box: { south: number, north: number, east: number, west: number }) {
        //
    }

    async fetchGeoOpportunities(organization: number, box: { south: number, north: number, east: number, west: number }, limit: number, query: string | null) {
        let start = currentTime();
        let clauses: any[] = [{ term: { orgId: organization } }];
        if (query) {
            clauses.push(buildElasticQuery(this.parser.parseQuery(query)));
        }
        let hits = await ElasticClient.search({
            index: 'prospecting',
            type: 'opportunity',
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

        // ElasticClient.scroll({ scrollId: hits._scroll_id!!, scroll: '60000' });

        console.warn('Searched in ' + (currentTime() - start) + ' ms');
        start = currentTime();
        let res = await DB.Opportunities.findAll({
            where: {
                id: {
                    $in: hits.hits.hits.map((v) => v._id)
                }
            },
            include: [{
                model: DB.Lot,
                as: 'lot',
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                }]
            }]
            // raw: true
        });
        console.warn('Fetched in ' + (currentTime() - start) + ' ms (' + res.length + ')');
        // console.warn(res);
        return res;
    }

    async fetchNext(organization: number, state: string, sort: OpportunitySort | null, query: string | null, initialId?: number) {
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

        let clauses: any[] = [{ term: { orgId: organization } }];
        if (state) {
            clauses.push({ term: { state: state } });
        }
        if (query) {
            clauses.push(buildElasticQuery(this.parser.parseQuery(query)));
        }
        let essort: any[] = [{ 'updatedAt': { 'order': 'desc' } }, { '_id': { 'order': 'asc' } }];
        if (sort === 'AREA_ASC') {
            essort = [{ 'area': { 'order': 'asc' } }, { '_id': { 'order': 'asc' } }];
        } else if (sort === 'AREA_DESC') {
            essort = [{ 'area': { 'order': 'desc' } }, { '_id': { 'order': 'asc' } }];
        }
        let hits = await ElasticClient.search({
            index: 'prospecting',
            type: 'opportunity',
            size: 1,
            body: {
                query: {
                    bool: {
                        must: clauses
                    }
                },
                sort: essort
            }
        });

        if (hits.hits.hits.length > 0) {
            return DB.Opportunities.findById(hits.hits.hits[0]._id);
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