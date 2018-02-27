import { CallContext } from './CallContext';
import { DB } from '../tables';
import { Developer } from '../tables';
import { applyAlterString } from '../utils/updater';
import { AreaContext } from './Area';

export const Resolver = {
    Organization: {
        id: (src: Developer) => src.id,
        slug: (src: Developer) => src.slug,
        title: (src: Developer) => src.title,
        logo: (src: Developer) => src.logo,
        cover: (src: Developer) => src.cover,
        url: (src: Developer) => src.url,
        city: (src: Developer) => src.city,
        address: (src: Developer) => src.address,
        linkedin: (src: Developer) => src.linkedin,
        facebook: (src: Developer) => src.facebook,
        twitter: (src: Developer) => src.twitter,
        comments: (src: Developer) => src.comments,
        isDeveloper: (src: Developer) => src.isDeveloper,
        isConstructor: (src: Developer) => src.isConstructor,
        description: (src: Developer) => src.description,
        developerIn: (src: Developer) => src.developerProjects || src.getDeveloperProjects(),
        constructorIn: (src: Developer) => src.constructorProjects || src.getConstructorProjects(),
        buildingProjects: (src: Developer) => src.developerProjects || src.getDeveloperProjects(),
        partners: async (src: Developer) => {
            let developerProjects = src.developerProjects!! || await src.getDeveloperProjects();
            let constructorProjects = src.constructorProjects! || await src.getConstructorProjects();
            let developers = new Set<number>();
            for (let p of developerProjects) {
                (await p.getDevelopers()).forEach((d) => {
                    if (d.id !== src.id) {
                        developers.add(d.id!!);
                    }
                });
                (await p.getConstructors()).forEach((d) => {
                    if (d.id !== src.id) {
                        developers.add(d.id!!);
                    }
                });
            }
            for (let p of constructorProjects) {
                (await p.getDevelopers()).forEach((d) => {
                    if (d.id !== src.id) {
                        developers.add(d.id!!);
                    }
                });
                (await p.getConstructors()).forEach((d) => {
                    if (d.id !== src.id) {
                        developers.add(d.id!!);
                    }
                });
            }

            return DB.Developer.findAll({
                where: {
                    account: src.account,
                    id: {
                        $in: Array.from(developers)
                    }
                }
            });
        }
    },
    Area: {
        organizations: function (context: AreaContext, args: {}) {
            return DB.Developer.findAll({
                where: { account: context._areadId }, order: ['slug'], include:
                    [{
                        model: DB.BuidlingProject,
                        as: 'developerProjects'
                    }, {
                        model: DB.BuidlingProject,
                        as: 'constructorProjects'
                    }]
            });
        },
        organization: function (context: AreaContext, args: { slug: string }) {
            return DB.Developer.findOne({ where: { account: context._areadId, slug: args.slug } });
        }
    },
    Query: {
        organizations: function (_: any, args: {}, context: CallContext) {
            return DB.Developer.findAll({
                where: { account: context.accountId }, order: ['slug'], include:
                    [{
                        model: DB.BuidlingProject,
                        as: 'developerProjects'
                    }, {
                        model: DB.BuidlingProject,
                        as: 'constructorProjects'
                    }]
            });
        },
        organization: function (_: any, args: { slug: string }, context: CallContext) {
            return DB.Developer.findOne({ where: { account: context.accountId, slug: args.slug } });
        }
    },
    Mutation: {
        organizationAdd: async function (_: any, args: { slug: string, title: string }, context: CallContext) {
            context.requireWriteAccess();
            return DB.Developer.create({
                account: context.accountId,
                slug: args.slug.toLowerCase(),
                title: args.title
            });
        },
        organizationRemove: async function (_: any, args: { slug: string }, context: CallContext) {
            context.requireWriteAccess();
            let existing = await DB.Developer.findOne({
                where: {
                    account: context.accountId,
                    slug: args.slug.toLowerCase()
                }
            });
            if (existing) {
                await existing.destroy();
                return 'ok';
            } else {
                throw 'Not found';
            }
        },
        organizationAlter: async function (_: any, args: {
            slug: string,
            title?: string,
            logo?: string | null,
            cover?: string | null,
            city?: string | null,
            address?: string | null,
            url?: string | null,
            twitter?: string | null
            linkedin?: string | null
            facebook?: string | null
            comments?: string | null,
            isDeveloper?: boolean,
            isConstructor?: boolean,
            description?: string | null,
        }, context: CallContext) {
            context.requireWriteAccess();
            let existing = await DB.Developer.findOne({
                where: {
                    account: context.accountId,
                    slug: args.slug.toLowerCase()
                }
            });
            if (!existing) {
                throw 'Not found';
            }

            if (args.title !== undefined) {
                existing.title = args.title;
            }
            if (args.logo !== undefined) {
                existing.logo = applyAlterString(args.logo);
            }
            if (args.cover !== undefined) {
                existing.cover = applyAlterString(args.cover);
            }
            if (args.city !== undefined) {
                existing.city = applyAlterString(args.city);
            }
            if (args.address !== undefined) {
                existing.address = applyAlterString(args.address);
            }
            if (args.url !== undefined) {
                existing.url = applyAlterString(args.url);
            }
            if (args.twitter !== undefined) {
                existing.twitter = applyAlterString(args.twitter);
            }
            if (args.linkedin !== undefined) {
                existing.linkedin = applyAlterString(args.linkedin);
            }
            if (args.facebook !== undefined) {
                existing.facebook = applyAlterString(args.facebook);
            }
            if (args.comments !== undefined) {
                existing.comments = applyAlterString(args.comments);
            }
            if (args.isDeveloper !== undefined) {
                existing.isDeveloper = args.isDeveloper;
            }
            if (args.isConstructor !== undefined) {
                existing.isConstructor = args.isConstructor;
            }
            if (args.description !== undefined) {
                existing.description = applyAlterString(args.description);
            }

            await existing.save();
            return existing;
        }
    }
};