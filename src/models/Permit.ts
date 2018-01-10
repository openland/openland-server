import { CallContext } from './CallContext';
import { DB } from '../tables';
import { applyPermits } from '../repositories/Permits';
import { PermitStatus, Permit, PermitType } from '../tables/Permit';
import { SelectBuilder } from '../utils/SelectBuilder';
import { dateDiff } from '../utils/date_utils';
import { Chart, prepareHistogram } from '../utils/charts';
import { ElasticClient } from '../indexing';
import { currentTime, printElapsed } from '../utils/timer';

export const Schema = `

    type Permit {
        id: ID!
        type: PermitType
        typeWood: Boolean
        status: PermitStatus
        statusUpdatedAt: String
        
        createdAt: String
        issuedAt: String
        completedAt: String
        expiredAt: String
        expiresAt: String
        startedAt: String
        filedAt: String
        
        approvalTime: Int

        streetNumbers: [StreetNumber!]!

        existingStories: Int
        proposedStories: Int
        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int
        proposedUse: String
        description: String

        events: [PermitEvent!]!

        relatedPermits: [Permit!]!

        governmentalUrl: String!

        fasterThan: Int
    }

    enum PermitStatus {
        FILING
        FILED
        ISSUED 
        COMPLETED
        EXPIRED
        CANCELLED 
        DISAPPROVED 
        APPROVED 
        ISSUING
        REVOKED
        WITHDRAWN
        PLANCHECK
        SUSPENDED
        REINSTATED
        INSPECTING
        UPHELD
        INCOMPLETE
        GRANTED
        APPEAL
    }

    enum PermitType {
        NEW_CONSTRUCTION
        ADDITIONS_ALTERATIONS_REPARE
        OTC_ADDITIONS
        WALL_OR_PAINTED_SIGN
        SIGN_ERRECT
        DEMOLITIONS
        GRADE_QUARRY_FILL_EXCAVATE
    }
    
    enum PermitSorting {
        CREATE_TIME
        COMPLETE_TIME
        ISSUED_TIME
        APPROVAL_TIME_ASC
        APPROVAL_TIME_DESC
    }

    type PermitEventStatus {
        oldStatus: PermitStatus
        newStatus: PermitStatus
        date: String
    }

    type PermitEventFieldChanged {
        fieldName: String!
        oldValue: String
        newValue: String
        date: String
    }

    union PermitEvent = PermitEventStatus | PermitEventFieldChanged

    type PermitEdge {
        node: Permit!
        cursor: String!
    }

    type PermitsConnection {
        edges: [PermitEdge!]!
        pageInfo: PageInfo!
        stats: PermitsStats!
    }
    
    type PermitsStats {
        approvalTimes: Chart!
        approvalDistribution: Chart!        
    }

    extend type Query {
        permits(filter: String, type: PermitType, sort: PermitSorting, minUnits: Int,
                issuedYear: String, fromPipeline: Boolean,
                first: Int!, after: String, page: Int): PermitsConnection
        permit(id: ID!): Permit
        permitsApprovalStats: Chart!
        permitsApprovalUnits: Chart!
    }

    input PermitInfo {
        id: ID!
        status: PermitStatus
        type: PermitType
        typeWood: Boolean
        statusUpdatedAt: String
        
        createdAt: String
        issuedAt: String
        completedAt: String
        startedAt: String
        expiredAt: String
        expiresAt: String
        filedAt: String

        street: [StreetNumberInfo!]

        existingStories: Int
        proposedStories: Int
        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int
        proposedUse: String
        description: String
    }

    input StreetNumberInfo {
        streetName: String!
        streetNameSuffix: String
        streetNumber: Int!
        streetNumberSuffix: String
    }

    extend type Mutation {
        updatePermits(state: String!, county: String!, city: String!, sourceDate: String!, permits: [PermitInfo]!): String
    }
`;

interface PermitInfo {
    id: string;
    status?: PermitStatus;
    type?: PermitType;
    typeWood?: boolean;

    statusUpdatedAt?: string;
    createdAt?: string;
    issuedAt?: string;
    filedAt?: string;
    startedAt?: string;
    completedAt?: string;
    expiredAt?: string;
    expiresAt?: string;

    street?: [StreetNumberInfo];

    existingStories?: number;
    proposedStories?: number;
    existingUnits?: number;
    proposedUnits?: number;
    existingAffordableUnits?: number;
    proposedAffordableUnits?: number;
    proposedUse?: string;
    description?: string;
}

interface StreetNumberInfo {
    streetName: string;
    streetNameSuffix?: string | null;
    streetNumber: number;
    streetNumberSuffix?: string | null;
}

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
        streetNumbers: (src: Permit) => src.streetNumbers!!.map((n) => ({
            streetId: n.street!!.id,
            streetName: n.street!!.name,
            streetNameSuffix: n.street!!.suffix,
            streetNumber: n.number,
            streetNumberSuffix: n.suffix
        })),
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
            let numbers = (await src.getStreetNumbers()).map((p) => p.id!!);
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
        permits: async function (_: any, args: {
            filter?: string, type?: string, sort?: string,
            minUnits?: number, issuedYear?: string, fromPipeline?: boolean,
            first: number, after?: string, page?: number
        }, context: CallContext) {

            let builder = new SelectBuilder(DB.Permit)
                .after(args.after)
                .page(args.page)
                .limit(args.first)
                .whereEq('account', context.accountId);
            //
            // if (args.sort === 'APPROVAL_TIME_ASC') {
            //     builder = builder.where('"permitIssued" IS NOT NULL');
            //     builder = builder.where('"permitCreated" IS NOT NULL');
            //     builder = builder.orderByRaw('"permitIssued" - "permitCreated"', 'ASC NULLS LAST');
            // } else if (args.sort === 'APPROVAL_TIME_DESC') {
            //     builder = builder.where('"permitIssued" IS NOT NULL');
            //     builder = builder.where('"permitCreated" IS NOT NULL');
            //     builder = builder.orderByRaw('"permitIssued" - "permitCreated"', 'DESC NULLS LAST');
            // } else if (args.sort === 'COMPLETE_TIME') {
            //     builder = builder.orderBy('permitCompleted', 'DESC NULLS LAST');
            // } else if (args.sort === 'ISSUED_TIME') {
            //     builder = builder.orderBy('permitIssued', 'DESC NULLS LAST');
            // } else {
            //     builder = builder.orderBy('permitCreated', 'DESC NULLS LAST');
            // }
            //
            // if (args.type) {
            //     builder = builder.whereEq('permitType', args.type.toLocaleLowerCase());
            // }
            // if (args.minUnits) {
            //     builder = builder.where('"proposedUnits" > ' + args.minUnits);
            //     builder = builder.where('"proposedUnits" IS NOT NULL');
            // }
            // if (args.issuedYear) {
            //     builder = builder.where('"permitIssued" IS NOT NULL');
            //     builder = builder.where('"permitIssued" >= \'' + args.issuedYear + '-01-01\'');
            // }
            // if (args.fromPipeline) {
            //     let allPermits = [];
            //     let allProjects = (await DB.BuidlingProject.findAll({
            //         where: {
            //             account: context.accountId
            //         },
            //         include: [{
            //             model: DB.Permit,
            //             as: 'permits',
            //         }]
            //     }));
            //     for (let p of allProjects) {
            //         for (let pr of p.permits!!) {
            //             if (allPermits.indexOf(pr.id) < 0) {
            //                 allPermits.push(pr.id);
            //             }
            //         }
            //     }
            //     builder = builder.whereIn(['id'], [allPermits]);
            // }

            // let approvalPercentile: Chart = {
            //     labels: ['1%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '95%', '96%', '97%', '98%', '99%'],
            //     datasets: [{
            //         label: 'Approval Times',
            //         values: (await builder
            //             .where('"permitIssued" IS NOT NULL')
            //             .percentile([0.01, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.96, 0.97, 0.98, 0.99], '"permitIssued" - "permitCreated"'))
            //     }]
            // };

            // let distribution = [0, 10, 50, 80, 90, 95, 100, 120, 150, 200, 300, 400, 500, 900, 1800, 3000, 6000, 8000];
            // // let largeBuildings = prepareHistogram(await builder
            // //     .where('"proposedUnits" >= 10')
            // //     .histogramSum('proposedUnits', '"permitIssued" - "permitCreated"'), distribution);
            // // let smallBuildings = prepareHistogram(await builder
            // //     .where('"proposedUnits" < 10')
            // //     .histogramSum('proposedUnits', '"permitIssued" - "permitCreated"'), distribution);
            // let approvalDistribution: Chart = {
            //     labels: largeBuildings.map((v) => v.value.toString()),
            //     datasets: [{
            //         label: 'Units in Small Buildings',
            //         values: smallBuildings.map((v) => v.count)
            //     }, {
            //         label: 'Units in Large Buildings',
            //         values: largeBuildings.map((v) => v.count)
            //     }]
            // };

            let start = currentTime();
            let clauses: any[] = [];
            clauses.push({term: {'account': context.accountId}});
            if (args.filter) {
                clauses.push({
                    bool: {
                        should: [
                            {match: {'address': {query: args.filter, operator: 'and'}}},
                            {match_phrase_prefix: {'permitId': args.filter}}
                        ]
                    }
                });
            }
            if (args.type) {
                clauses.push({term: {'permitType': args.type.toLocaleLowerCase()}});
            }
            if (args.minUnits) {
                clauses.push({range: {'proposedUnits': {'gt': args.minUnits}}});
            }
            if (args.issuedYear) {
                clauses.push({range: {'permitIssued': {'gte': args.issuedYear}}});
            }

            let sort: any = [];
            if (args.sort === 'APPROVAL_TIME_ASC') {
                sort = [{'approvalTime': {'order': 'asc'}}];
                clauses.push({exists: {field: 'approvalTime'}});
            } else if (args.sort === 'APPROVAL_TIME_DESC') {
                sort = [{'approvalTime': {'order': 'desc'}}];
                clauses.push({exists: {field: 'approvalTime'}});
            } else if (args.sort === 'COMPLETE_TIME') {
                sort = [{'permitCompleted': {'order': 'desc'}}];
                clauses.push({exists: {field: 'permitCompleted'}});
            } else if (args.sort === 'ISSUED_TIME') {
                sort = [{'permitIssued': {'order': 'desc'}}];
                clauses.push({exists: {field: 'permitIssued'}});
            } else {
                sort = [{'permitCreated': {'order': 'desc'}}];
                clauses.push({exists: {field: 'permitCreated'}});
            }

            let hits = await ElasticClient.search({
                index: 'permits',
                type: 'permit',
                size: args.first,
                from: args.page ? (args.page!! * args.first) : 0,
                body: {
                    query: {bool: {must: clauses}},
                    sort: sort
                }
            });
            start = printElapsed('searched', start);
            console.warn(`searched(reported) in ${hits.took} ms`);
            let res = await builder.findElastic(hits);
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
                throw 'City is not found for ' + args.state + ', ' + args.county + ', ' + args.city;
            }
            await applyPermits(call.accountId, city.id!!, args.sourceDate, args.permits);
            return 'ok';
        }
    }
};