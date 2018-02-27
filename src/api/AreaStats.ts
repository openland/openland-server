import { DB } from '../tables';
import { ElasticClient } from '../indexing/index';
import { cachedInt } from '../modules/cache';
import { AreaContext } from './Area';

function resolve(id: number) {
    return {
        _areaId: id,
        totalProjects: cachedInt(`projects_${id}`, async () => DB.BuidlingProject.count({ where: { account: id } })),
        totalProjectsVerified: cachedInt(`projects_verified_${id}`, async () => DB.BuidlingProject.count({ where: { account: id, verified: true } })),
        totalDevelopers: cachedInt(`developers_${id}`, async () => DB.Developer.count({ where: { account: id, isDeveloper: true } })),
        totalConstructors: cachedInt(`constructors_${id}`, async () => DB.Developer.count({ where: { account: id, isConstructor: true } })),
        totalOrganizations: cachedInt(`organizations_${id}`, async () => DB.Developer.count({ where: { account: id } })),
        totalPermits: cachedInt(`permits_${id}`, async () => ElasticClient.count({
            index: 'permits', type: 'permit',
            body: {
                query: {
                    term: { 'account': id }
                }
            }
        }).then((v) => v.count)),
    };
}

export const Resolver = {
    Area: {
        stats: async function (context: AreaContext) {
            return resolve(context._areadId);
        }
    }
};