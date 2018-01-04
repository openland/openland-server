import { CallContext } from './CallContext';
import { DB } from '../tables';
import { BuildingProject } from '../tables';
import { resolveStreetView, resolvePicture } from '../utils/pictures';
import { SelectBuilder } from '../utils/SelectBuilder';

export const Schema = `
    type BuildingProject {
        id: ID!
        slug: String!
        name: String!
        description: String
        status: String
        startedAt: String
        completedAt: String
        expectedCompletedAt: String
        verified: Boolean!

        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int

        picture(height: Int, width: Int): Picture
        
        extrasDeveloper: String
        extrasGeneralConstructor: String
        extrasYearEnd: String
        extrasAddress: String
        extrasAddressSecondary: String
        extrasPermit: String
        extrasComment: String
        extrasUrl: String
        extrasLocation: Geo

        permits: [Permit!]!

        developers: [Organization!]!
    }

    type BuildingProjectEdge {
        node: BuildingProject!
        cursor: String!
    }

    type BuildingProjectConnectionStats {
        newUnits: Int!
        newUnitsVerified: Int!
        totalProjects: Int!
        totalProjectsVerified: Int!
    }

    type BuildingProjectConnection {
        edges: [BuildingProjectEdge!]!
        pageInfo: PageInfo!
        stats: BuildingProjectConnectionStats!
    }

    type BuildingProjectStats {
        projectsTracked: Int!
        projectsVerified: Int!
        year2017NewUnits: Int!
        year2017NewUnitsVerified: Int!
        year2018NewUnits: Int!
        year2018NewUnitsVerified: Int!
    }

    extend type Query {
        buildingProjects(filter: String, minUnits: Int, year: String, first: Int!, after: String): BuildingProjectConnection!
        buildingProjectsStats: BuildingProjectStats!
        buildingProject(slug: String!): BuildingProject!
    }

    input BuildingProjectInput {
        id: ID!
        name: String
        description: String
        verified: Boolean

        existingUnits: Int
        proposedUnits: Int
        existingAffordableUnits: Int
        proposedAffordableUnits: Int
        
        permits: [ID!]
    }
`;

export const Resolver = {
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
            return src.getDevelopers!!();
        },
        permits: (src: BuildingProject) => {
            return src.getPermits();
        }
    },
    Query: {
        buildingProjectsStats: async function (_: any, args: {}, context: CallContext) {

            let projectsQuery = new SelectBuilder(DB.BuidlingProject)
                .whereEq('account', context.accountId);
            let projectsTracked = projectsQuery
                .count();
            let projectsVerified = projectsQuery
                .whereEq('verified', true)
                .count();

            let year2017NewUnits = projectsQuery
                .whereEq('extrasYearEnd', '2017')
                .sum('\"proposedUnits" - "existingUnits\"');
            let year2017NewUnitsVerified = projectsQuery
                .whereEq('extrasYearEnd', '2017')
                .whereEq('verified', true)
                .sum('\"proposedUnits" - "existingUnits\"');
            let year2018NewUnits = projectsQuery
                .whereEq('extrasYearEnd', '2018')
                .sum('\"proposedUnits" - "existingUnits\"');
            let year2018NewUnitsVerified = projectsQuery
                .whereEq('extrasYearEnd', '2018')
                .whereEq('verified', true)
                .sum('\"proposedUnits" - "existingUnits\"');
            return {
                projectsTracked: projectsTracked,
                projectsVerified: projectsVerified,
                year2017NewUnits: year2017NewUnits,
                year2017NewUnitsVerified: year2017NewUnitsVerified,
                year2018NewUnits: year2018NewUnits,
                year2018NewUnitsVerified: year2018NewUnitsVerified,
            };
        },
        buildingProjects: async function (_: any, args: { first: number, minUnits?: number, year?: string, filter?: string, after?: string }, context: CallContext) {
            let builder = new SelectBuilder(DB.BuidlingProject)
                .whereEq('account', context.accountId)
                .filterField('name')
                .filterField('extrasAddress')
                .filterField('extrasAddressSecondary')
                .limit(args.first)
                .after(args.after)
                .filter(args.filter)
                .whereEq('account', context.accountId)
                .postProcessor((src) => src.sort((a, b) => {
                    if (a.proposedUnits != null && b.proposedUnits != null && a.existingUnits != null && b.existingUnits != null) {
                        return (b.proposedUnits!! - b.existingUnits!!) - (a.proposedUnits!! - a.existingUnits!!);
                    } else if (a.proposedUnits != null && a.existingUnits != null) {
                        return -1;
                    } else if (b.proposedUnits != null && b.existingUnits != null) {
                        return 1;
                    } else {
                        return b.id!! - a.id!!;
                    }
                }));
            if (args.minUnits) {
                builder = builder.where('"proposedUnits"-"existingUnits" >= ' + args.minUnits);
            }
            if (args.year) {
                builder = builder.whereEq('extrasYearEnd', args.year);
            }
            let verified = builder.whereEq('verified', true);

            return {
                ...(await builder.findAll()),
                stats: {
                    newUnits: builder.sum('\"proposedUnits"-"existingUnits\"'),
                    newUnitsVerified: verified.sum('\"proposedUnits"-"existingUnits\"'),
                    totalProjects: builder.count(),
                    totalProjectsVerified: verified.count()
                }
            };
        },
        buildingProject: function (_: any, args: { slug: number }, call: CallContext) {
            return DB.BuidlingProject.findOne({
                where: {
                    account: call.accountId,
                    projectId: args.slug
                }
            });
        }
    },
};