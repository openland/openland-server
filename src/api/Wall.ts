import { resolveID, withAccount, withAny, withOrgOwner } from './utils/Resolvers';
import { DB } from '../tables';
import { IDs } from './utils/IDs';
import { WallPost } from '../tables/WallPost';
import { SelectBuilder } from '../modules/SelectBuilder';
import { defined, enumString, optional, stringNotEmpty, validate } from '../modules/NewInputValidator';
import { WallPostsWorker } from '../workers';
import { ImageRef } from '../repositories/Media';
import { ListingExtras, Range } from '../repositories/OrganizationExtras';
import { Sanitizer } from '../modules/Sanitizer';
import { InvalidInputError } from '../errors/InvalidInputError';
import { buildElasticQuery, QueryParser } from '../modules/QueryParser';
import { ElasticClient } from '../indexing';
import { Services } from '../services';

const EntityTypes: { [key: string]: string } = {
    'NEWS': 'WallPost',
    'LISTING': 'WallListing'
};

interface PostInput {
    text: string;
    type: string;
    isPinned: boolean;
    tags: string[];
    links: { url: string, text: string };
}

interface ListingInput {
    isPinned: boolean;
    type: 'development_opportunity' | 'acquisition_request';

    // common
    name: string;
    summary?: string | null;
    specialAttributes?: string[] | null;
    status?: 'open' | null;
    photo?: ImageRef | null;

    // DO
    location?: { lon: number, lat: number, ref?: string, count?: number };
    locationTitle?: string;
    availability?: string | null;
    area?: number | null;
    price?: number | null;
    dealType?: string[] | null;
    shapeAndForm?: string[] | null;
    currentUse?: string[] | null;
    goodFitFor?: string[] | null;
    additionalLinks?: { text: string, url: string }[] | null;

    // AR
    shortDescription?: string | null;
    areaRange?: Range | null;
    geographies?: string[] | null;
    landUse?: string[] | null;
    unitCapacity?: string[] | null;
}

interface WallSearchParams {
    query?: string;
    first: number;
    after?: string;
    page?: number;
}

export const Resolver = {
    PostLink: {
        extraInfo: (src: any) => src.extraInfo || null
    },

    WallPost: {
        id: resolveID(IDs.WallEntity),
        creator: async (src: WallPost) => await DB.User.findById(src.creatorId),
        lastEditor: async (src: WallPost) => src.lastEditor ? await DB.User.findById(src.lastEditor) : null,
        type: (src: WallPost) => src.extras!.type || 'UNKNOWN',
        isPinned: (src: WallPost) => src.isPinned,
        organization: (src: WallPost) => DB.Organization.findById(src.orgId),
        tags: (src: WallPost) => src.extras!.tags || [],
        links: (src: WallPost) => src.extras!.links || []
    },

    WallListing: {
        id: resolveID(IDs.WallEntity),
        creator: async (src: WallPost) => await DB.User.findById(src.creatorId),
        lastEditor: async (src: WallPost) => src.lastEditor ? await DB.User.findById(src.lastEditor) : null,
        isPinned: (src: WallPost) => src.isPinned,
        organization: (src: WallPost) => DB.Organization.findById(src.orgId),

        name: (src: WallPost) => src.text,
        type: (src: WallPost) => src.extras && src.extras.type,
        summary: (src: WallPost) => src.extras && src.extras.summary,
        specialAttributes: (src: WallPost) => src.extras && src.extras.specialAttributes,
        status: (src: WallPost) => src.extras && src.extras.status,
        updatedAt: (src: WallPost) => (src as any).updatedAt,
        photo: (src: WallPost) => src.extras && src.extras.photo,

        // DO
        location: (src: WallPost) => src.extras && src.extras.location,
        locationTitle: (src: WallPost) => src.extras && src.extras.locationTitle,
        availability: (src: WallPost) => src.extras && src.extras.availability,
        area: (src: WallPost) => src.extras && src.extras.area,
        price: (src: WallPost) => src.extras && src.extras.price,
        dealType: (src: WallPost) => src.extras && src.extras.dealType,
        shapeAndForm: (src: WallPost) => src.extras && src.extras.shapeAndForm,
        currentUse: (src: WallPost) => src.extras && src.extras.currentUse,
        goodFitFor: (src: WallPost) => src.extras && src.extras.goodFitFor,
        additionalLinks: (src: WallPost) => src.extras && src.extras.additionalLinks,
        // AR
        shortDescription: (src: WallPost) => src.extras && src.extras.shortDescription,
        areaRange: (src: WallPost) => src.extras && src.extras.areaRange,
        geographies: (src: WallPost) => src.extras && src.extras.geographies,
        landUse: (src: WallPost) => src.extras && src.extras.landUse,
        unitCapacity: (src: WallPost) => src.extras && src.extras.unitCapacity,
    },

    WallEntity: {
        __resolveType(src: WallPost) {
            return EntityTypes[src.type!];
        }
    },

    Query: {
        wallEntity: withAny<{ id: string }>(async (args) => {
            let post = await DB.WallPost.findById(IDs.WallEntity.parse(args.id));

            if (!post) {
                return null;
            }

            return post;
        }),

        wall: withAny<{ orgId: string, first: number, after?: string, page?: number }>(async (args) => {
            let builder = new SelectBuilder(DB.WallPost)
                .whereEq('isDeleted', false)
                .whereEq('orgId', IDs.Organization.parse(args.orgId))
                .orderBy('isPinned', 'DESC')
                .orderBy('createdAt')
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return builder.findAll([], {});
        }),

        wallMyOrg: withAccount<{ first: number, after?: string, page?: number }>(async (args, uid, orgId) => {
            let builder = new SelectBuilder(DB.WallPost)
                .whereEq('isDeleted', false)
                .whereEq('orgId', orgId)
                .orderBy('isPinned', 'DESC')
                .orderBy('createdAt')
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return builder.findAll([], {});
        }),

        wallSearch: withAccount<WallSearchParams>(async (args, uid, orgId) => {
            let clauses: any[] = [];

            if (args.query) {
                let parser = new QueryParser();
                parser.registerText('tag', 'tags');
                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                clauses.push(elasticQuery);
            }

            let hits = await ElasticClient.search({
                index: 'wall_posts',
                type: 'wall_post',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    query: {bool: {must: clauses}}
                }
            });

            let builder = new SelectBuilder(DB.WallPost)
                .after(args.after)
                .whereEq('isDeleted', false)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
        }),
    },

    Mutation: {
        wallAddPost: withOrgOwner<{ input: PostInput }>(async (args, uid, oid) => {
            await validate(
                {
                    text: stringNotEmpty(),
                    type: enumString(['UPDATE', 'NEWS']),
                    tags: [, stringNotEmpty()],
                    links: [
                        ,
                        {
                            text: stringNotEmpty(`Text can't be empty!`),
                            url: stringNotEmpty(`Url can't be empty!`)
                        }
                    ]
                },
                args.input
            );

            return DB.tx(async (tx) => {
                if (args.input.isPinned === true) {
                    await DB.WallPost.update(
                        {isPinned: false},
                        {where: {orgId: oid}, transaction: tx}
                    );
                }

                return await DB.WallPost.create({
                    creatorId: uid,
                    orgId: oid,
                    text: args.input.text,
                    type: 'NEWS',
                    extras: {
                        type: args.input.type,
                        tags: args.input.tags || [],
                        links: args.input.links || []
                    },
                    isPinned: args.input.isPinned,
                }, {transaction: tx});
            });
        }),

        wallEditPost: withOrgOwner<{ id: string, input: PostInput }>(async (args, uid, oid) => {
            await validate(
                {
                    text: stringNotEmpty(),
                    type: enumString(['UPDATE', 'NEWS']),
                    tags: [, stringNotEmpty()],
                    links: [
                        ,
                        {
                            text: stringNotEmpty(`Text can't be empty!`),
                            url: stringNotEmpty(`Url can't be empty!`)
                        }
                    ]
                },
                args.input
            );

            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id),
                        type: 'NEWS'
                    },
                    transaction: tx
                });

                if (!post) {
                    return null;
                }

                if (args.input.isPinned === true) {
                    await DB.WallPost.update(
                        {isPinned: false},
                        {where: {orgId: oid}, transaction: tx}
                    );
                }

                let updatetPost = await post.update(
                    {
                        text: args.input.text,
                        lastEditor: uid,
                        extras: {
                            type: args.input.type,
                            tags: args.input.tags || [],
                            links: args.input.links || []
                        }
                    },
                    {transaction: tx}
                );

                await WallPostsWorker.pushWork({postId: post.id!});

                return updatetPost;
            });
        }),

        wallAddListing: withOrgOwner<{ input: ListingInput }>(async (args, uid, oid) => {
            await validate(
                {
                    type: defined(enumString(['development_opportunity', 'acquisition_request'])),
                    name: defined(stringNotEmpty(`Name can't be empty!`)),
                    status: optional(enumString(['open'])),
                    additionalLinks: [
                        ,
                        {
                            text: stringNotEmpty(`Text can't be empty!`),
                            url: stringNotEmpty(`Url can't be empty!`)
                        }
                    ]
                },
                args.input
            );

            return DB.tx(async (tx) => {
                if (args.input.isPinned === true) {
                    await DB.WallPost.update(
                        {isPinned: false},
                        {where: {orgId: oid}, transaction: tx}
                    );
                }

                // common
                let extras = {} as ListingExtras;
                if (args.input.summary !== undefined) {
                    extras.summary = Sanitizer.sanitizeString(args.input.summary);
                }

                if (args.input.specialAttributes !== undefined) {
                    extras.specialAttributes = Sanitizer.sanitizeAny(args.input.specialAttributes);
                }

                if (args.input.photo !== undefined) {
                    if (args.input.photo !== null) {
                        await Services.UploadCare.saveFile(args.input.photo.uuid);
                    }
                    extras.photo = Sanitizer.sanitizeImageRef(args.input.photo);
                }

                // DO
                if (args.input.location !== undefined) {
                    extras.location = Sanitizer.sanitizeAny(args.input.location)!;
                }

                // extras.locationTitle = Sanitizer.sanitizeString(args.input.locationTitle)!;
                // if (args.type === 'development_opportunity' && !extras.locationTitle) {
                //     extrasValidateError.push({ key: 'input.locationTitle', message: 'Full address can\'t be empty' });
                // }
                if (args.input.locationTitle !== undefined) {
                    extras.locationTitle = Sanitizer.sanitizeAny(args.input.locationTitle)!;
                }

                if (args.input.availability !== undefined) {
                    extras.availability = Sanitizer.sanitizeString(args.input.availability);
                }

                if (args.input.area !== undefined) {
                    extras.area = Sanitizer.sanitizeNumber(args.input.area);
                }

                if (args.input.price !== undefined) {
                    extras.price = Sanitizer.sanitizeNumber(args.input.price);
                }

                if (args.input.dealType !== undefined) {
                    extras.dealType = Sanitizer.sanitizeAny(args.input.dealType);
                }

                if (args.input.shapeAndForm !== undefined) {
                    extras.shapeAndForm = Sanitizer.sanitizeAny(args.input.shapeAndForm);
                }

                if (args.input.currentUse !== undefined) {
                    extras.currentUse = Sanitizer.sanitizeAny(args.input.currentUse);
                }

                if (args.input.goodFitFor !== undefined) {
                    extras.goodFitFor = Sanitizer.sanitizeAny(args.input.goodFitFor);
                }

                // AR
                if (args.input.shortDescription !== undefined) {
                    extras.shortDescription = Sanitizer.sanitizeString(args.input.shortDescription);
                }

                if (args.input.areaRange !== undefined) {
                    extras.areaRange = Sanitizer.sanitizeAny(args.input.areaRange);
                }

                if (args.input.landUse !== undefined) {
                    extras.landUse = Sanitizer.sanitizeAny(args.input.landUse);
                }

                if (args.input.geographies !== undefined) {
                    extras.geographies = Sanitizer.sanitizeAny(args.input.geographies);
                }

                if (args.input.unitCapacity !== undefined) {
                    extras.unitCapacity = Sanitizer.sanitizeAny(args.input.unitCapacity);
                }

                return await DB.WallPost.create({
                    creatorId: uid,
                    orgId: oid,
                    text: args.input.name,
                    type: 'LISTING',
                    extras: {
                        ...extras as any,
                        type: args.input.type
                    },
                    isPinned: args.input.isPinned,
                }, {transaction: tx});
            });
        }),

        wallEditListing: withOrgOwner<{ id: string, input: ListingInput }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id),
                        type: 'LISTING'
                    },
                    transaction: tx
                });

                if (!post) {
                    return null;
                }

                if (args.input.isPinned === true) {
                    await DB.WallPost.update(
                        {isPinned: false},
                        {where: {orgId: oid}, transaction: tx}
                    );
                }

                let extrasValidateError: { key: string, message: string }[] = [];

                await validate(
                    {
                        type: defined(enumString(['development_opportunity', 'acquisition_request'])),
                        name: defined(stringNotEmpty(`Name cant't be empty`)),
                        status: optional(enumString(['open'])),
                        additionalLinks: [
                            ,
                            {
                                text: stringNotEmpty(`Text can't be empty!`),
                                url: stringNotEmpty(`Url can't be empty!`)
                            }
                        ]
                    },
                    args.input
                );

                // basic
                if (args.input.name !== undefined) {
                    post.text = args.input.name;
                }

                // common
                let extras = post.extras! as ListingExtras;
                if (args.input.summary !== undefined) {
                    extras.summary = Sanitizer.sanitizeString(args.input.summary);
                }

                if (args.input.specialAttributes !== undefined) {
                    extras.specialAttributes = Sanitizer.sanitizeAny(args.input.specialAttributes);
                }

                if (args.input.status !== undefined) {
                    extras.status = Sanitizer.sanitizeString(args.input.status) as ('open' | null);
                }

                if (args.input.photo !== undefined) {
                    if (args.input.photo !== null) {
                        await Services.UploadCare.saveFile(args.input.photo.uuid);
                    }
                    extras.photo = Sanitizer.sanitizeImageRef(args.input.photo);
                }

                // DO
                if (args.input.location !== undefined) {
                    extras.location = Sanitizer.sanitizeAny(args.input.location)!;
                }

                // if (args.input.locationTitle !== undefined) {
                //     extras.locationTitle = Sanitizer.sanitizeString(args.input.locationTitle)!;
                //     if (existing.type === 'development_opportunity' && !extras.locationTitle) {
                //         extras.locationTitle = Sanitizer.sanitizeString(args.input.locationTitle);
                //         extrasValidateError.push({ key: 'input.locationTitle', message: 'Full address can\'t be empty' });
                //     }
                // }
                if (args.input.locationTitle !== undefined) {
                    extras.locationTitle = Sanitizer.sanitizeAny(args.input.locationTitle)!;
                }

                if (args.input.availability !== undefined) {
                    extras.availability = Sanitizer.sanitizeString(args.input.availability);
                }

                if (args.input.area !== undefined) {
                    extras.area = Sanitizer.sanitizeNumber(args.input.area);
                }

                if (args.input.price !== undefined) {
                    extras.price = Sanitizer.sanitizeNumber(args.input.price);
                }

                if (args.input.dealType !== undefined) {
                    extras.dealType = Sanitizer.sanitizeAny(args.input.dealType);
                }

                if (args.input.shapeAndForm !== undefined) {
                    extras.shapeAndForm = Sanitizer.sanitizeAny(args.input.shapeAndForm);
                }

                if (args.input.currentUse !== undefined) {
                    extras.currentUse = Sanitizer.sanitizeAny(args.input.currentUse);
                }

                if (args.input.goodFitFor !== undefined) {
                    extras.goodFitFor = Sanitizer.sanitizeAny(args.input.goodFitFor);
                }

                if (args.input.additionalLinks !== undefined) {
                    extras.additionalLinks = Sanitizer.sanitizeAny(args.input.additionalLinks);
                }

                // AR
                if (args.input.shortDescription !== undefined) {
                    extras.shortDescription = Sanitizer.sanitizeString(args.input.shortDescription);
                }

                if (args.input.areaRange !== undefined) {
                    extras.areaRange = Sanitizer.sanitizeAny(args.input.areaRange);
                }

                if (args.input.landUse !== undefined) {
                    extras.landUse = Sanitizer.sanitizeAny(args.input.landUse);
                }

                if (args.input.geographies !== undefined) {
                    extras.geographies = Sanitizer.sanitizeAny(args.input.geographies);
                }

                if (args.input.unitCapacity !== undefined) {
                    extras.unitCapacity = Sanitizer.sanitizeAny(args.input.unitCapacity);
                }

                post.extras = {
                    ...extras as any,
                    type: args.input.type
                };

                if (extrasValidateError.length > 0) {
                    throw new InvalidInputError(extrasValidateError);
                }

                await post.save({transaction: tx});
                return post;
            });
        }),

        wallDeleteEntity: withOrgOwner<{ id: string }>(async (args, uid, oid) => {
            await DB.WallPost.update(
                {
                    isDeleted: true
                },
                {
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id)
                    }
                });

            return 'ok';
        }),

        wallPin: withOrgOwner<{ id: string }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id)
                    },
                    transaction: tx
                });

                if (!post) {
                    return 'ok';
                }

                await DB.WallPost.update(
                    {isPinned: false},
                    {where: {orgId: oid}, transaction: tx}
                );

                await DB.WallPost.update(
                    {isPinned: true},
                    {where: {orgId: oid, id: IDs.WallEntity.parse(args.id)}, transaction: tx}
                );

                return 'ok';
            });
        }),

        wallUnpin: withOrgOwner<{ id: string }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id)
                    },
                    transaction: tx
                });

                if (!post) {
                    return 'ok';
                }

                await DB.WallPost.update(
                    {isPinned: false},
                    {where: {orgId: oid, id: IDs.WallEntity.parse(args.id)}, transaction: tx}
                );

                return 'ok';
            });
        }),
    }
};