import * as DB from '../connector'
import * as b64 from 'base-64'
import { Context } from './Context'

export interface Vote {
    key: string
    count: number
    own_set: boolean
}

export const Schema = `
    type Vote {
        id: ID!
        count: Int!
        own_set: Boolean!
    }
    extend type Query {
        vote(id: ID!): Vote
    }
    extend type Mutation {
        vote(id: ID!): Vote
        unvote(id: ID!): Vote
    }
`

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
    console.warn(user)
    if (user != null) {
        ownSet = await DB.Votes.count({
            where: {
                vote: id,
                userId: user
            }
        }) > 0
    }
    return {
        id: b64.encode((res.id as number).toString()),
        count: count,
        own_set: ownSet
    }
}

export const Resolver = {
    Query: {
        vote: async function (_: any, params: { id: string }, context: Promise<Context>) {
            var convid = parseInt(b64.decode(params.id))
            var uid = (await context).userKey
            return resolveVote(convid, uid)
        }
    },
    Mutation: {
        vote: async function (_: any, params: { id: string }, context: Promise<Context>) {
            var convid = parseInt(b64.decode(params.id))
            var uid = (await context).userKey
            if (uid == null) {
                throw Error("Voting could be done only for logged in users")
            }

            await resolveVote(convid, uid)

            try {
                await DB.Votes.create({
                    userId: uid,
                    vote: convid
                })
            } catch (e) {
                // console.error(e)
                // Ignore...
            }

            return resolveVote(convid, uid)
        },

        unvote: async function (_: any, params: { id: string }, context: Promise<Context>) {

            var convid = parseInt(b64.decode(params.id))

            console.warn(context)
            var uid = (await context).userKey
            if (uid == null) {
                throw Error("Voting could be done only for logged in users")
            }

            await resolveVote(convid, uid)

            try {
                var r = await DB.Votes.destroy({
                    where: {
                        userId: uid,
                        vote: convid
                    }
                })
                console.warn(r)
            } catch (e) {
                console.error(e)
                // Ignore...
            }

            return resolveVote(convid, uid)
        }
    }
}