import * as DB from '../connector'
import * as b64 from 'base-64'
import { Context } from './Context'
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

async function resolveVote(id: number, user?: number) {
    var res = await DB.Vote.find({ where: { id: id } }) as any
    if (res == null) {
        res = await DB.Vote.create({ id: id })
    }
    var count = await DB.Votes.count({
        where: {
            vote: id
        }
    })
    var ownSet = false
    if (user != null) {
        ownSet = await DB.Votes.count({
            where: {
                vote: id,
                userId: user
            }
        }).any() as boolean
    }
    return {
        key: b64.encode(res.id),
        count: count,
        own_set: ownSet
    }
}
export const Query = ["vote(id: Int!): Vote"]
export const Mutation = ["vote(id: Int!): Vote"]
export const Resolver = {
    Query: {
        vote: async function (_: any, params: { id: number }, context: Promise<Context>) {
            console.warn((await context).userKey)
            return resolveVote(params.id)
        }
    },
    Mutation: {
        vote: async function (_: any, params: { id: number }, context: Promise<Context>) {
            console.warn(context)
            var uid = (await context).userKey
            if (uid == null){
                throw Error("Voting could be done only for logged in users")
            }

            await resolveVote(params.id)

            try {
                await DB.Votes.create({
                    userId: uid,
                    vote: params.id
                })
            } catch (e) {
                // Ignore...
            }

            return resolveVote(params.id)
        }
    }
}