import { CallContext } from './CallContext';
import { DB } from '../tables';

export const Schema = `
    type GlobalStats {
        totalProjects: Int!
        totalDevelopers: Int!
        totalConstructors: Int!
        totalOrganizations: Int!
        totalPermits: Int!        
    }
    
    extend type Query {
        globalStats: GlobalStats!
    }

    extend type Area {
        stats: GlobalStats!
    }
`;

export const Resolver = {
    Area: {
        stats: async function (context: { id: number }) {
            return {
                totalProjects: DB.BuidlingProject.count({ where: { account: context.id } }),
                totalDevelopers: DB.Developer.count({ where: { account: context.id, isDeveloper: true } }),
                totalConstructors: DB.Developer.count({ where: { account: context.id, isConstructor: true } }),
                totalOrganizations: DB.Developer.count({ where: { account: context.id } }),
                totalPermits: DB.Permit.count({ where: { account: context.id } }),
            };
        }
    },
    Query: {
        globalStats: async function (_: any, args: {}, context: CallContext) {
            return {
                totalProjects: DB.BuidlingProject.count({ where: { account: context.accountId } }),
                totalDevelopers: DB.Developer.count({ where: { account: context.accountId, isDeveloper: true } }),
                totalConstructors: DB.Developer.count({ where: { account: context.accountId, isConstructor: true } }),
                totalOrganizations: DB.Developer.count({ where: { account: context.accountId } }),
                totalPermits: DB.Permit.count({ where: { account: context.accountId } }),
            };
        }
    }
};