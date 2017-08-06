import { DB } from '../tables'
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
    var res = await DB.Vote.find({ where: { slug: id } })
    if (res == null) {
        res = await DB.Vote.create({ slug: id })
    }

    var count = await DB.UserVote.count({
        where: {
            vote: res.id!!
        }
    })
    var ownSet = false
    console.warn(user)
    if (user != null) {
        ownSet = await DB.UserVote.count({
            where: {
                vote: res.id!!,
                userId: user
            }
        }) > 0
    }
    return {
        _dbid: res.id!!,
        id: res.slug,
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



            var vote = await resolveVote(params.id, context.uid)

            try {
                await DB.UserVote.create({
                    userId: context.uid,
                    vote: vote._dbid
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

            var vote = await resolveVote(params.id, context.uid)

            try {
                var r = await DB.UserVote.destroy({
                    where: {
                        userId: context.uid,
                        vote: vote._dbid
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