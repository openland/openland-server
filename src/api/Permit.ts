import { CallContext } from './utils/CallContext';
import { DB } from '../tables';
import { applyPermits } from '../repositories/Permits';
import { Permit } from '../tables/Permit';
import { SelectBuilder } from '../modules/SelectBuilder';
import { dateDiff } from '../utils/date_utils';
import { Chart, prepareHistogram, elasticChart, elasticQuarterChart } from '../utils/charts';
import { ElasticClient } from '../indexing';
import { currentTime, printElapsed } from '../utils/timer';
import { cachedObject } from '../modules/cache';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { PermitInfo } from './types';

export const Resolver = {
    PermitEvent: {
        __resolveType: (src: any) => {
            return src.__typename;
        }
    },
    Permit: {
        id: (src: Permit) => src.permitId,
        status: (src: Permit) => {
            if (src.permitStatus) {
                return src.permitStatus.toUpperCase();
            } else {
                return null;
            }
        },
        type: (src: Permit) => {
            if (src.permitType) {
                return src.permitType.toUpperCase();
            } else {
                return null;
            }
        },
        typeWood: (src: Permit) => src.permitTypeWood,
        statusUpdatedAt: (src: Permit) => src.permitStatusUpdated,
        createdAt: (src: Permit) => src.permitCreated,
        issuedAt: (src: Permit) => src.permitIssued,
        expiredAt: (src: Permit) => src.permitExpired,
        expiresAt: (src: Permit) => src.permitExpires,
        startedAt: (src: Permit) => src.permitStarted,
        filedAt: (src: Permit) => src.permitFiled,
        completedAt: (src: Permit) => src.permitCompleted,

        approvalTime: (src: Permit) => {
            if (src.permitCreated && src.permitIssued) {
                return dateDiff(new Date(src.permitCreated), new Date(src.permitIssued));
            } else {
                return null;
            }
        },

        existingStories: (src: Permit) => src.existingStories,
        proposedStories: (src: Permit) => src.proposedStories,
        existingUnits: (src: Permit) => src.existingUnits,
        proposedUnits: (src: Permit) => src.proposedUnits,
        existingAffordableUnits: (src: Permit) => src.existingAffordableUnits,
        proposedAffordableUnits: (src: Permit) => src.proposedAffordableUnits,
        proposedUse: (src: Permit) => src.proposedUse,
        description: (src: Permit) => src.description,
        governmentalUrl: (src: Permit) => 'https://dbiweb.sfgov.org/dbipts/default.aspx?page=Permit&PermitNumber=' + src.permitId,
        streetNumbers: async (src: Permit) => {
            let numbers = src.streetNumbers;
            if (!numbers) {
                numbers = await src.getStreetNumbers({
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                });
            }
            if (!numbers) {
                numbers = [];
            }
            return numbers.map((n) => ({
                streetId: n.street!!.id,
                streetName: n.street!!.name,
                streetNameSuffix: n.street!!.suffix,
                streetNumber: n.number,
                streetNumberSuffix: n.suffix
            }));
        },
        fasterThan: async (src: Permit) => {
            if (src.permitFiled != null && src.permitIssued != null) {
                let start = new Date(src.permitFiled);
                let end = new Date(src.permitIssued);
                let len = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                let builder = new SelectBuilder(DB.Permit)
                    .where('\"permitType" = \'' + src.permitType + '\'')
                    .where('\"permitFiled" IS NOT NULL')
                    .where('\"permitIssued" IS NOT NULL');
                let fasterValue = builder
                    .where('\"permitIssued"-"permitFiled" >= ' + len)
                    .count();
                let total = builder.count();

                return Math.round((await fasterValue) * 100 / (await total));
            }
            return null;
        },
        events: (src: Permit) => {
            return src.events!!.map((e) => {
                if (e.eventType === 'status_changed') {
                    return {
                        __typename: 'PermitEventStatus',
                        oldStatus: e.eventContent.oldStatus ? e.eventContent.oldStatus.toUpperCase() : null,
                        newStatus: e.eventContent.newStatus ? e.eventContent.newStatus.toUpperCase() : null,
                        date: e.eventDate
                    };
                } else if (e.eventType === 'field_changed') {
                    return {
                        __typename: 'PermitEventFieldChanged',
                        fieldName: e.eventContent.field,
                        oldValue: e.eventContent.oldValue,
                        newValue: e.eventContent.newValue,
                        date: e.eventDate
                    };
                } else {
                    return null;
                }
            }).filter((v) => v !== null);
        },
        relatedPermits: async (src: Permit) => {
            let numbers = [...new Set((await src.getStreetNumbers()).map((p) => p.id!!))];
            return DB.Permit.findAll({
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }],
                    where: {
                        id: {
                            $in: numbers
                        }
                    }
                }],
                order: [['permitCreated', 'DESC']]
            });
        }
    },
    Query: {
        permit: async function (_: any, args: { id: string }, context: CallContext) {
            let res = await DB.Permit.findOne({
                where: {
                    account: context.accountId,
                    permitId: args.id
                },
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street'
                    }]
                }, {
                    model: DB.PermitEvents,
                    as: 'events'
                }]
            });
            if (res != null) {
                return res;
            } else {
                return null;
            }
        },
        permitsUnitsIssuedStats: async function (_: any, args: {}, context: CallContext) {
            let res = await cachedObject('permitsUnitsIssuedStats_' + context.accountId, () => ElasticClient.search({
                index: 'permits',
                type: 'permit',
                body: {
                    aggs: {
                        main: {
                            date_histogram: {
                                field: 'permitIssued',
                                interval: '1y',
                                'time_zone': 'GMT',
                                'min_doc_count': 1
                            },
                            'aggs': {
                                'value': {
                                    'sum': {
                                        'field': 'netUnits'
                                    }
                                }
                            }
                        }
                    },
                    query: {
                        bool: {
                            must: [{
                                range: {
                                    permitIssued: {
                                        gte: '2007',
                                        lt: '2018'
                                    }
                                }
                            },
                            {
                                term: { 'account': context.accountId }
                            }]
                        }
                    }
                }
            }));
            return elasticChart('Permits Issued — Net New Units', res);
        },
        permitsUnitsFiledStatsMonthly: async function (_: any, args: {}, context: CallContext) {
            let res = await cachedObject('permitsUnitsFiledStatsMonthly2_' + context.accountId, () => ElasticClient.search({
                index: 'permits',
                type: 'permit',
                body: {
                    aggs: {
                        main: {
                            date_histogram: {
                                field: 'permitFiled',
                                interval: 'quarter',
                                'time_zone': 'GMT',
                                'min_doc_count': 1
                            },
                            'aggs': {
                                'value': {
                                    'sum': {
                                        'field': 'netUnits'
                                    }
                                }
                            }
                        }
                    },
                    query: {
                        bool: {
                            must: [{
                                range: {
                                    permitFiled: {
                                        gte: '2014',
                                        lt: '2018'
                                    }
                                }
                            },
                            {
                                term: { 'account': context.accountId }
                            }]
                        }
                    }
                }
            }));
            return elasticQuarterChart('Permits Filed — Net New Units', res);
        },
        permitsUnitsFiledStats: async function (_: any, args: {}, context: CallContext) {
            let res = await cachedObject('permitsUnitsFiledStats_' + context.accountId, () => ElasticClient.search({
                index: 'permits',
                type: 'permit',
                body: {
                    aggs: {
                        main: {
                            date_histogram: {
                                field: 'permitFiled',
                                interval: '1y',
                                'time_zone': 'GMT',
                                'min_doc_count': 1
                            },
                            'aggs': {
                                'value': {
                                    'sum': {
                                        'field': 'netUnits'
                                    }
                                }
                            }
                        }
                    },
                    query: {
                        bool: {
                            must: [{
                                range: {
                                    permitFiled: {
                                        gte: '2007',
                                        lt: '2018'
                                    }
                                }
                            },
                            {
                                term: { 'account': context.accountId }
                            }]
                        }
                    }
                }
            }));
            return elasticChart('Permits Filed — Net New Units', res);
        },
        permitsUnitsCompletedStats: async function (_: any, args: {}, context: CallContext) {
            let res = await cachedObject('permitsUnitsCompletedStats_' + context.accountId, () => ElasticClient.search({
                index: 'permits',
                type: 'permit',
                body: {
                    aggs: {
                        main: {
                            date_histogram: {
                                field: 'permitCompleted',
                                interval: '1y',
                                'time_zone': 'GMT',
                                'min_doc_count': 1
                            },
                            'aggs': {
                                'value': {
                                    'sum': {
                                        'field': 'netUnits'
                                    }
                                }
                            }
                        }
                    },
                    query: {
                        bool: {
                            must: [{
                                range: {
                                    permitCompleted: {
                                        gte: '2007',
                                        lt: '2018'
                                    }
                                }
                            },
                            {
                                term: { 'account': context.accountId }
                            }]
                        }
                    }
                }
            }));
            return elasticChart('Permits Completed — Net New Units', res);
        },
        permits: async function (_: any, args: {
            filter?: string, type?: string, sort?: string,
            minUnits?: number, issuedYear?: string, fromPipeline?: boolean,
            first: number, after?: string, page?: number
        }, context: CallContext) {

            let start = currentTime();
            let clauses: any[] = [];
            clauses.push({ term: { 'account': context.accountId } });
            if (args.filter) {
                clauses.push({
                    bool: {
                        should: [
                            { match: { 'address': { query: args.filter, operator: 'and' } } },
                            { match_phrase_prefix: { 'permitId': args.filter } }
                        ]
                    }
                });
            }
            if (args.type) {
                clauses.push({ term: { 'permitType': args.type.toLocaleLowerCase() } });
            }
            if (args.minUnits) {
                clauses.push({ range: { 'proposedUnits': { 'gt': args.minUnits } } });
            }
            if (args.issuedYear) {
                clauses.push({ range: { 'permitIssued': { 'gte': args.issuedYear } } });
            }
            if (args.fromPipeline) {
                let allPermits = [];
                let allProjects = (await DB.BuidlingProject.findAll({
                    where: {
                        account: context.accountId
                    },
                    include: [{
                        model: DB.Permit,
                        as: 'permits',
                    }]
                }));
                for (let p of allProjects) {
                    for (let pr of p.permits!!) {
                        if (allPermits.indexOf(pr.id) < 0) {
                            allPermits.push(pr.id);
                        }
                    }
                }
                clauses.push({
                    'terms': {
                        _id: allPermits
                    }
                });
            }

            let sort: any = [];
            if (args.sort === 'APPROVAL_TIME_ASC') {
                sort = [{ 'approvalTime': { 'order': 'asc' } }];
                clauses.push({ exists: { field: 'approvalTime' } });
            } else if (args.sort === 'APPROVAL_TIME_DESC') {
                sort = [{ 'approvalTime': { 'order': 'desc' } }];
                clauses.push({ exists: { field: 'approvalTime' } });
            } else if (args.sort === 'COMPLETE_TIME') {
                sort = [{ 'permitCompleted': { 'order': 'desc' } }];
                clauses.push({ exists: { field: 'permitCompleted' } });
            } else if (args.sort === 'ISSUED_TIME') {
                sort = [{ 'permitIssued': { 'order': 'desc' } }];
                clauses.push({ exists: { field: 'permitIssued' } });
            } else if (args.sort === 'STATUS_CHANGE_TIME') {
                sort = [{ 'permitStatusUpdated': { 'order': 'desc' } }];
                clauses.push({ exists: { field: 'permitStatusUpdated' } });
            } else {
                sort = [{ 'permitCreated': { 'order': 'desc' } }];
                clauses.push({ exists: { field: 'permitCreated' } });
            }

            let hits = await ElasticClient.search({
                index: 'permits',
                type: 'permit',
                size: args.first,
                from: args.page ? (args.page!! * args.first) : 0,
                body: {
                    query: { bool: { must: clauses } },
                    sort: sort
                }
            });
            start = printElapsed('searched', start);
            console.warn(`searched(reported) in ${hits.took} ms`);
            let builder = new SelectBuilder(DB.Permit)
                .after(args.after)
                .page(args.page)
                .limit(args.first)
                .whereEq('account', context.accountId);
            let res = await builder.findElastic(hits, [{
                model: DB.StreetNumber,
                as: 'streetNumbers',
                include: [{
                    model: DB.Street,
                    as: 'street',
                }]
            }]);
            printElapsed('loaded', start);

            return {
                ...res,
                // stats: {
                //     approvalTimes: approvalPercentile,
                //     approvalDistribution: approvalDistribution
                // }
            };
        },
        permitsApprovalStats: async function (_: any, args: {}, call: CallContext) {
            let builder = new SelectBuilder(DB.Permit)
                .filterField('permitId')
                .whereEq('account', call.accountId)
                .where('"permitIssued" IS NOT NULL')
                .where('"permitIssued" >= \'2007-01-01\'')
                .whereEq('permitType', 'new_construction')
                .where('"proposedUnits" IS NOT NULL');

            let distribution = [0, 10, 50, 80, 90, 95, 100, 120, 150, 200, 300, 400, 500, 900, 1800, 3000, 6000, 8000];

            let largeBuildings = prepareHistogram(await builder
                .where('"proposedUnits" >= 10')
                .histogramSum('proposedUnits', '"permitIssued" - "permitCreated"'), distribution);

            let smallBuildings = prepareHistogram(await builder
                .where('"proposedUnits" < 10')
                .histogramSum('proposedUnits', '"permitIssued" - "permitCreated"'), distribution);

            let approvalTimes: Chart = {
                labels: largeBuildings.map((v) => v.value.toString()),
                datasets: [{
                    label: 'Units in Small Buildings',
                    values: smallBuildings.map((v) => v.count)
                }, {
                    label: 'Units in Large Buildings',
                    values: largeBuildings.map((v) => v.count)
                }]
            };

            return approvalTimes;
        },
        permitsApprovalUnits: async function (_: any, args: {}, call: CallContext) {
            let builder = new SelectBuilder(DB.Permit)
                .filterField('permitId')
                .whereEq('account', call.accountId)
                .where('"permitIssued" IS NOT NULL')
                .where('"permitIssued" >= \'2007-01-01\'')
                .whereEq('permitType', 'new_construction')
                .where('"proposedUnits" IS NOT NULL');

            let unitsLarge = await builder
                .where('"proposedUnits" > 10')
                .histogramSum('proposedUnits', 'extract(year from "permitIssued")');

            let unitsSmall = await builder
                .where('"proposedUnits" <= 10')
                .histogramSum('proposedUnits', 'extract(year from "permitIssued")');

            let approvalTimes: Chart = {
                labels: unitsLarge.map((v) => v.value.toString()),
                datasets: [{
                    label: 'Small Buildings',
                    values: unitsSmall.map((v) => v.count)
                }, {
                    label: 'Large Buildings',
                    values: unitsLarge.map((v) => v.count)
                }]
            };

            return approvalTimes;
        }
    },
    Mutation: {
        updatePermits: async function (_: any, args: { state: string, county: string, city: string, sourceDate: string, permits: [PermitInfo] }, call: CallContext) {
            let city = await DB.City.findOne({
                where: {
                    name: args.city
                },
                include: [{
                    model: DB.County,
                    as: 'county',
                    where: {
                        name: args.county
                    },
                    include: [{
                        model: DB.State,
                        as: 'state',
                        where: {
                            code: args.state
                        }
                    }]
                }]
            });
            if (!city) {
                throw new NotFoundError(ErrorText.unableToFindCity(args.state, args.county, args.city));
            }
            await applyPermits(call.accountId, city.id!!, args.sourceDate, args.permits);
            return 'ok';
        }
    }
};