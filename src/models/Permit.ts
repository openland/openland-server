import { CallContext } from "./CallContext";
import { DB } from "../tables/index";
import { applyPermits } from "../repositories/Permits";
import { PermitStatus, Permit, PermitType } from "../tables/Permit";
import { SelectBuilder } from "../utils/SelectBuilder";

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

    type PermitEventStatus {
        oldStatus: PermitStatus
        newStatus: PermitStatus
        date: String
    }

    type PermitEventFieldChanged {
        fieldName: String!
        oldValue: String
        newValue: String
    }

    union PermitEvent = PermitEventStatus | PermitEventFieldChanged

    type PermitEdge {
        node: Permit!
        cursor: String!
    }

    type PermitsConnection {
        edges: [PermitEdge!]!
        pageInfo: PageInfo!
    }

    extend type Query {
        permits(filter: String, first: Int!, after: String, page: Int): PermitsConnection
        permit(id: ID!): Permit
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
        expiredAt: String
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
        updatePermits(permits: [PermitInfo]!): String
    }
`

interface PermitInfo {
    id: string
    status?: PermitStatus
    type?: PermitType
    typeWood?: boolean

    statusUpdatedAt?: string
    createdAt?: string
    issuedAt?: string
    completedAt?: string
    expiredAt?: string
    street?: [StreetNumberInfo]

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
    streetName: string
    streetNameSuffix?: string
    streetNumber: number
    streetNumberSuffix?: string
}

export const Resolver = {
    PermitEvent: {
        __resolveType: (src: any) => {
            return src.__typename
        }
    },
    Permit: {
        id: (src: Permit) => src.permitId,
        status: (src: Permit) => {
            if (src.permitStatus) {
                return src.permitStatus.toUpperCase()
            } else {
                return null
            }
        },
        type: (src: Permit) => {
            if (src.permitType) {
                return src.permitType.toUpperCase()
            } else {
                return null
            }
        },
        typeWood: (src: Permit) => src.permitTypeWood,
        statusUpdatedAt: (src: Permit) => src.permitStatusUpdated,
        createdAt: (src: Permit) => src.permitCreated,
        issuedAt: (src: Permit) => src.permitIssued,
        expiredAt: (src: Permit) => src.permitExpired,
        completedAt: (src: Permit) => src.permitCompleted,
        existingStories: (src: Permit) => src.existingStories,
        proposedStories: (src: Permit) => src.proposedStories,
        existingUnits: (src: Permit) => src.existingUnits,
        proposedUnits: (src: Permit) => src.proposedUnits,
        existingAffordableUnits: (src: Permit) => src.existingAffordableUnits,
        proposedAffordableUnits: (src: Permit) => src.proposedAffordableUnits,
        proposedUse: (src: Permit) => src.proposedUse,
        description: (src: Permit) => src.description,
        streetNumbers: (src: Permit) => src.streetNumbers!!.map((n) => ({
            streetId: n.street!!.id,
            streetName: n.street!!.name,
            streetNameSuffix: n.street!!.suffix,
            streetNumber: n.number,
            streetNumberSuffix: n.suffix
        })),
        events: (src: Permit) => {
            return src.events!!.map((e) => {
                if (e.eventType === "status_changed") {
                    return {
                        __typename: "PermitEventStatus",
                        oldStatus: e.eventContent.oldStatus ? e.eventContent.oldStatus.toUpperCase() : null,
                        newStatus: e.eventContent.newStatus ? e.eventContent.newStatus.toUpperCase() : null,
                        date: e.eventContent.time
                    }
                } else if (e.eventType === "field_changed") {
                    return {
                        __typename: "PermitEventFieldChanged",
                        fieldName: e.eventContent.field,
                        oldValue: e.eventContent.oldValue,
                        newValue: e.eventContent.newValue,
                    }
                } else {
                    return null;
                }
            }).filter((v) => v !== null);
        }
    },
    Query: {
        permit: async function (_: any, args: { id: string }, context: CallContext) {
            var res = await DB.Permit.findOne({
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
            })
            if (res != null) {
                return res
            } else {
                return null
            }
        },
        permits: async function (_: any, args: { filter?: string, first: number, after?: string, page?: number }, context: CallContext) {
            let builder = new SelectBuilder(DB.Permit)
                .filterField("permitId")
                .filter(args.filter)
                .after(args.after)
                .page(args.page)
                .limit(args.first)
                .whereEq("account", context.accountId)
                .orderBy("permitCreated", "DESC NULLS LAST")
            return builder.findAll([{
                model: DB.StreetNumber,
                as: 'streetNumbers',
                include: [{
                    model: DB.Street,
                    as: 'street'
                }]
            }, {
                model: DB.PermitEvents,
                as: 'events'
            }])
        }
    },
    Mutation: {
        updatePermits: async function (_: any, args: { permits: [PermitInfo] }, context: CallContext) {
            await applyPermits(context.accountId, args.permits)
            return "ok"
        }
    }
}