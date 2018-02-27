import { CallContext } from './CallContext';
import { DB } from '../tables';
import { BuildingProject } from '../tables';
import { resolveStreetView, resolvePicture } from '../utils/pictures';
import { SelectBuilder } from '../utils/SelectBuilder';
import { dateDiff } from '../utils/date_utils';
import { cachedInt, isCached } from '../modules/cache';
import * as DataLoader from 'dataloader';
import { setTimeout } from 'timers';
import { Repos } from '../repositories/index';

let buildingProjectLoader = new DataLoader<number, BuildingProject>(async (v) => {
    let mapped = v.map((id) => DB.BuidlingProject.findById(id, {
        include: [{
            model: DB.Permit,
            as: 'permits',
            include: [{
                model: DB.StreetNumber,
                as: 'streetNumbers',
                include: [{
                    model: DB.Street,
                    as: 'street',
                }]
            }]
        }]
    })
    );
    let res: BuildingProject[] = [];
    for (let m of mapped) {
        res.push((await m)!!);
    }

    // Cache Timeout
    setTimeout(() => {
        for (let f of v) {
            buildingProjectLoader.clear(f);
        }
    }, 60 * 1000);

    return res;
});

let fetchProjects = async (areaId: number) => {
    let fastestProject: BuildingProject | null = null;
    let slowestProject: BuildingProject | null = null;
    let cached = await isCached(`fastest_${areaId}`, `slowest_${areaId}`);
    if (cached !== false) {
        fastestProject = await buildingProjectLoader.load(cached[0]);
        slowestProject = await buildingProjectLoader.load(cached[1]);
    }

    if (fastestProject === null || slowestProject === null) {
        let allProjects = (await DB.BuidlingProject.findAll({
            where: {
                account: areaId
            },
            include: [{
                model: DB.Permit,
                as: 'permits',
                include: [{
                    model: DB.StreetNumber,
                    as: 'streetNumbers',
                    include: [{
                        model: DB.Street,
                        as: 'street',
                    }]
                }]
            }]
        })).filter((v) =>
            (v.permits!!.find((p) => p.permitCreated !== null && p.permitIssued !== null))
            && (v.existingUnits != null)
            && (v.proposedUnits != null)
            && ((v.proposedUnits - v.existingUnits) >= 10));

        fastestProject = allProjects[0];
        slowestProject = allProjects[0];
        let fastestDuration = dateDiff(new Date(fastestProject.permits!![0].permitCreated!!), new Date(fastestProject.permits!![0].permitIssued!!));
        let slowestDuration = dateDiff(new Date(fastestProject.permits!![0].permitCreated!!), new Date(fastestProject.permits!![0].permitIssued!!));
        for (let proj of allProjects) {
            for (let p of proj.permits!!) {
                if (p.permitCreated && p.permitIssued) {
                    let duration = dateDiff(new Date(p.permitCreated!!), new Date(p.permitIssued!!));
                    if (duration < fastestDuration) {
                        fastestDuration = duration;
                        fastestProject = proj;
                    }
                    if (duration > slowestDuration) {
                        slowestDuration = duration;
                        slowestProject = proj;
                    }
                }
            }
        }
        await cachedInt(`fastest_${areaId}`, async () => fastestProject!!.id!!);
        await cachedInt(`slowest_${areaId}`, async () => slowestProject!!.id!!);
    }
    return [fastestProject!!, slowestProject!!];
};

let buildingProjects = async function (areaId: number, args: { first: number, minUnits?: number, year?: string, filter?: string, after?: string, page?: number }) {
    let builder = new SelectBuilder(DB.BuidlingProject)
        .whereEq('account', areaId)
        .filterField('name')
        .filterField('extrasAddress')
        .filterField('extrasAddressSecondary')
        .limit(args.first)
        .after(args.after)
        .filter(args.filter)
        .page(args.page)
        .whereEq('account', areaId)
        .orderByRaw('"proposedUnits"-"existingUnits"', 'DESC NULLS LAST');

    if (args.minUnits) {
        builder = builder.where('"proposedUnits"-"existingUnits" >= ' + args.minUnits);
    }
    if (args.year && args.year !== 'all') {
        builder = builder.whereEq('extrasYearEnd', args.year);
    }
    let verified = builder.whereEq('verified', true);

    return {
        ...(await builder.findAll([
            { model: DB.Developer, as: 'developers' },
            { model: DB.Developer, as: 'constructors' }
        ])),
        stats: {
            newUnits: builder.sum('\"proposedUnits"-"existingUnits\"'),
            newUnitsVerified: verified.sum('\"proposedUnits"-"existingUnits\"'),
            totalProjects: builder.count(),
            totalProjectsVerified: verified.count()
        }
    };
};

let buildingProject = function (areaId: number, args: { slug: number }) {
    return DB.BuidlingProject.findOne({
        where: {
            account: areaId,
            projectId: args.slug
        }
    });
};

export const Resolver = {
    AreaStats: {
        year2017NewUnits: (src: { _areaId: number }) => cachedInt(`units_2017_${src._areaId}`,
            () => new SelectBuilder(DB.BuidlingProject)
                .whereEq('account', src._areaId)
                .whereEq('extrasYearEnd', '2017')
                .sum('\"proposedUnits" - "existingUnits\"')),
        year2017NewUnitsVerified: (src: { _areaId: number }) => cachedInt(`units_2017_verified_${src._areaId}`,
            () => new SelectBuilder(DB.BuidlingProject)
                .whereEq('account', src._areaId)
                .whereEq('extrasYearEnd', '2017')
                .whereEq('verified', true)
                .sum('\"proposedUnits" - "existingUnits\"')),
        year2018NewUnits: (src: { _areaId: number }) => cachedInt(`units_2018_${src._areaId}`,
            () => new SelectBuilder(DB.BuidlingProject)
                .whereEq('account', src._areaId)
                .whereEq('extrasYearEnd', '2018')
                .sum('\"proposedUnits" - "existingUnits\"')),
        year2018NewUnitsVerified: (src: { _areaId: number }) => cachedInt(`units_2018_verified_${src._areaId}`,
            () => new SelectBuilder(DB.BuidlingProject)
                .whereEq('account', src._areaId)
                .whereEq('extrasYearEnd', '2018')
                .whereEq('verified', true)
                .sum('\"proposedUnits" - "existingUnits\"')),
        fastestApprovalProject: async (src: { _areaId: number }) => (await fetchProjects(src._areaId))[0],
        slowestApprovalProject: async (src: { _areaId: number }) => (await fetchProjects(src._areaId))[1]
    },
    BuildingProject: {
        id: (src: BuildingProject) => src.id,
        slug: (src: BuildingProject) => src.projectId,
        name: (src: BuildingProject) => src.name,
        description: (src: BuildingProject) => src.description,
        status: (src: BuildingProject) => src.status,
        startedAt: (src: BuildingProject) => src.projectStartedAt,
        completedAt: (src: BuildingProject) => src.projectCompletedAt,
        expectedCompletedAt: (src: BuildingProject) => src.projectExpectedCompletedAt,
        verified: (src: BuildingProject) => src.verified,

        existingUnits: (src: BuildingProject) => src.existingUnits,
        proposedUnits: (src: BuildingProject) => src.proposedUnits,
        existingAffordableUnits: (src: BuildingProject) => src.existingAffordableUnits,
        proposedAffordableUnits: (src: BuildingProject) => src.proposedAffordableUnits,

        picture: (src: BuildingProject, args: { height?: number, width?: number }, context: CallContext) => {
            if (src.picture) {
                return resolvePicture(src.picture, args.width, args.height);
            } else {
                if (args.height && args.width) {
                    return resolveStreetView(context, src.extrasAddress!!, args.height, args.width);
                } else {
                    return null;
                }
            }
        },

        extrasDeveloper: (src: BuildingProject) => src.extrasDeveloper,
        extrasGeneralConstructor: (src: BuildingProject) => src.extrasGeneralConstructor,
        extrasYearEnd: (src: BuildingProject) => src.extrasYearEnd,
        extrasAddress: (src: BuildingProject) => src.extrasAddress,
        extrasAddressSecondary: (src: BuildingProject) => src.extrasAddressSecondary,
        extrasPermit: (src: BuildingProject) => src.extrasPermit,
        extrasComment: (src: BuildingProject) => src.extrasComment,
        extrasUrl: (src: BuildingProject) => src.extrasUrl,
        extrasLocation: (src: BuildingProject) => {
            if (src.extrasLongitude != null && src.extrasLatitude != null) {
                return {
                    latitude: src.extrasLatitude,
                    longitude: src.extrasLongitude
                };
            } else {
                return undefined;
            }
        },
        developers: (src: BuildingProject) => {
            return src.developers || src.getDevelopers();
        },
        constructors: (src: BuildingProject) => {
            return src.constructors || src.getConstructors();
        },
        permits: (src: BuildingProject) => {
            if (src.permits !== undefined) {
                return src.permits;
            } else {
                return src.getPermits();
            }
        },
        approvalTime: async (src: BuildingProject) => {
            let perm;
            if (src.permits !== undefined) {
                perm = src.permits;
            } else {
                perm = await src.getPermits();
            }
            perm = perm.filter((v) => v.permitCreated && v.permitIssued);
            if (perm.length === 0) {
                return 0;
            } else {
                return Math.max(...perm.map((v) => dateDiff(new Date(v.permitCreated!!), new Date(v.permitIssued!!))));
            }
        },
    },
    Query: {
        buildingProjects: async function (_: any, args: { first: number, minUnits?: number, year?: string, filter?: string, after?: string }, context: CallContext) {
            return buildingProjects(context.accountId, args);
        },
        buildingProject: function (_: any, args: { slug: number }, call: CallContext) {
            return buildingProject(call.accountId, args);
        },
        projects: async function (_: any, args: { area: string, first: number, minUnits?: number, year?: string, filter?: string, after?: string }) {
            return buildingProjects((await Repos.Area.resolveArea(args.area)).id, args);
        },
        project: async function (_: any, args: { area: string, slug: number }) {
            return buildingProject((await Repos.Area.resolveArea(args.area)).id, args);
        }
    },
};