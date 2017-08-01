import * as DB from '../connector'
import * as b64 from 'base-64'

export interface Vote {
    key: string
    count: number
    own_set: boolean
}

export const Schema =
    `type Vote {
        key: String!
        count: Int!
        own_set: Boolean!
    }`

async function resolveVote(id: number) {
    var res = await DB.Vote.find({ where: { id: id } }) as any
    if (res == null) {
        res = await DB.Vote.create({ id: id })
    }
    var count = DB.Votes.count({
        where: {
            vote: id
        }
    })
    return {
        key: b64.encode(res.id),
        count: count,
        own_set: false
    }
}
export const Query = ["vote(id: Int!): Vote"]
export const Mutation = ["vote(id: Int!): Vote"]
export const Resolver = {
    Query: {
        vote: async function (_: any, params: { id: number }) {
            return resolveVote(params.id)
        }
    },
    Mutation: {
        vote: async function (_: any, params: { id: number }) {
            await resolveVote(params.id)

            try {
                await DB.Votes.create({
                    userId: 0,
                    vote: params.id
                })
            } catch (e) {
                // Ignore...
            }

            return resolveVote(params.id)
        }
    }
}