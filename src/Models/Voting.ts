import * as DB from '../tables'
import * as b64 from 'base-64'
import { Context } from './Context'

// Types

export interface Vote {
    key: string
    count: number
    own_set: boolean
}

// Schema

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

// Implementation

async function resolveVote(id: string, user?: number) {
    var res = await DB.Vote.find({ where: { id: id } }) as any
    if (res == null) {
        res = await DB.Vote.create({ id: id })
    }
    var count = await DB.UserVote.count({
        where: {
            vote: id
        }
    })
    var ownSet = false
    console.warn(user)
    if (user != null) {
        ownSet = await DB.UserVote.count({
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
        vote: async function (_: any, params: { id: string }, context: Context) {
            return resolveVote(params.id, context.uid)
        }
    },
    Mutation: {
        vote: async function (_: any, params: { id: string }, context: Context) {
            // var convid = parseInt(b64.decode(params.id))
            if (context.uid == null) {
                throw Error("Voting could be done only for logged in users")
            }

            

            await resolveVote(params.id, context.uid)

            try {
                await DB.UserVote.create({
                    userId: context.uid,
                    vote: params.id
                })
            } catch (e) {
                // console.error(e)
                // Ignore...
            }

            return resolveVote(params.id, context.uid)
        },

        unvote: async function (_: any, params: { id: string }, context: Context) {            
            if (context.uid == null) {
                throw Error("Voting could be done only for logged in users")
            }

            await resolveVote(params.id, context.uid)

            try {
                var r = await DB.UserVote.destroy({
                    where: {
                        userId: context.uid,
                        vote: params.id
                    }
                })
                console.warn(r)
            } catch (e) {
                console.error(e)
                // Ignore...
            }

            return resolveVote(params.id, context.uid)
        }
    }
}