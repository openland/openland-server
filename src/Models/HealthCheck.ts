import { Context } from './Context';

export const Schema = ``

export const Resolver = {
    Query: {
        healthCheck: async function(_obj: any, _params: { }, _context: Promise<Context>) {
            return "Hello World!"
        }
    },
    Mutation: {
        healthCheck: async function(_obj: any, _params: { }, _context: Promise<Context>) {
            return "Hello World!"
        }
    }
}