import { CallContext } from "./CallContext";
import { applyStreets } from "../repositories/Streets";

export const Schema = `

    type Street {
        id: ID!
        name: String
        suffix: String
        fullName: String
    }

    type StreetNumber {
        streetId: ID!
        streetName: String!
        streetNameSuffix: String
        streetNumber: Int!
        streetNumberSuffix: String
    }

    input StreetInfo {
        name: String!
        suffix: String
    }

    extend type Mutation {
        updateStreets(streets: [StreetInfo!]!): String
    }
`

interface StreetInfo {
    name: string
    suffix?: string
}

export const Resolver = {
    Mutation: {
        updateStreets: async function (_: any, args: { streets: [StreetInfo] }, context: CallContext) {
            await applyStreets(context.accountId, args.streets.map((s) => ({ streetName: s.name, streetNameSuffix: s.suffix })))
            return "ok"
        }
    }
}