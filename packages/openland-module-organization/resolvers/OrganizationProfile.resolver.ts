import { Context, createNamedContext } from '@openland/context';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { withUser, withAccount } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { inTx } from '@openland/foundationdb';
import { stringNotEmpty, validate } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Organization } from 'openland-module-db/store';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { createLogger } from '@openland/log';
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import { asyncRun } from '../../openland-utils/timer';
import { isDefined } from '../../openland-utils/misc';
import { MessageAttachmentFileInput } from '../../openland-module-messaging/MessageInput';
import { buildMessage, orgMention } from '../../openland-utils/MessageBuilder';

const log = createLogger('organization_profile_resolver');

const ORG_MEMBERS_EXPORT_WHITELIST = [
    '3YgM91xQP1sa3ea5mxxVTwRkJg'
];

const rootCtx = createNamedContext('organization');

export const Resolver: GQLResolver = {
    OrganizationProfile: {
        id: (src: Organization) => IDs.OrganizationProfile.serialize(src.id),
        name: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.name,
        photoRef: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.photo,

        website: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.website,
        websiteTitle: (src: Organization, args: {}, ctx: Context) => null,
        about: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.about,
        twitter: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.twitter,
        facebook: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.facebook,
        linkedin: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.linkedin,
        instagram: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.instagram,
        socialImage: async (src: Organization, args, ctx) => {
            let profile = await Store.OrganizationProfile.findById(ctx, src.id);
            return profile?.socialImage ? buildBaseImageUrl(profile.socialImage) : null;
        },

        alphaPublished: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationEditorial.findById(ctx, src.id)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization, args: {}, ctx: Context) => ((await Store.OrganizationEditorial.findById(ctx, src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',
        alphaIsPrivate: (src: Organization) => src.private || false,
        autosubscribeRooms: (src: Organization) => src.autosubscribeRooms?.map(a => IDs.Conversation.serialize(a)) || [],

        betaMembersCanInvite: (src: Organization) => src.membersCanInvite === null ? true : src.membersCanInvite,

        applyLink: async (src, args, ctx) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.applyLink,
        applyLinkEnabled: async (src, args, ctx) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.applyLinkEnabled || false,
    },
    Query: {
        myOrganizationProfile: async (_: any, args: {}, ctx: Context) => {
            if (ctx.auth.oid) {
                return await Store.Organization.findById(ctx, ctx.auth.oid);
            }
            return null;
        },
        organizationProfile: withUser(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.id);
            if (!(await Modules.Orgs.isUserAdmin(ctx, uid, oid)) && !(await Modules.Super.isSuperAdmin(ctx, uid))) {
                throw new AccessDeniedError();
            }
            let res = await Store.Organization.findById(ctx, oid);
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
    },
    Mutation: {
        updateOrganizationProfile: withAccount(async (parent, args, uid, oid) => {
            log.log(parent, 'updateOrganizationProfile', args.input);

            let orgId = oid;
            if (args.id) {
                orgId = IDs.Organization.parse(args.id);
            }

            let isSuper = ['super-admin', 'editor'].indexOf((await Modules.Super.superRole(parent, uid)) || 'none') > -1;

            let member = await Store.OrganizationMember.findById(parent, orgId, uid);
            let isMemberAdmin = (member !== null && member.status === 'joined' && member.role === 'admin');
            if (!isMemberAdmin && !isSuper) {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            return await inTx(parent, async (ctx) => {
                let existing = await Store.Organization.findById(ctx, orgId);

                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let isMemberOwner = uid === existing.ownerId;

                let nameChanged = false;
                let photoChanged = false;
                let profile = (await Store.OrganizationProfile.findById(ctx, orgId))!;

                if (args.input.name !== undefined) {
                    await validate(
                        stringNotEmpty(`Please enter a name for this ${existing.kind === 'organization' ? 'organization' : 'community'}`),
                        args.input.name,
                        'input.name'
                    );
                    profile.name = Sanitizer.sanitizeString(args.input.name)!;
                    nameChanged = true;
                }
                if (args.input.website !== undefined) {
                    profile.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
                    }
                    profile.photo = Sanitizer.sanitizeImageRef(args.input.photoRef);
                    photoChanged = true;
                }

                if (args.input.socialImageRef !== undefined) {
                    if (args.input.socialImageRef !== null) {
                        await Modules.Media.saveFile(ctx, args.input.socialImageRef.uuid);
                    }
                    profile.socialImage = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
                }

                if (args.input.twitter !== undefined) {
                    profile.twitter = Sanitizer.sanitizeString(args.input.twitter);
                }
                if (args.input.facebook !== undefined) {
                    profile.facebook = Sanitizer.sanitizeString(args.input.facebook);
                }
                if (args.input.linkedin !== undefined) {
                    profile.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                }
                if (args.input.instagram !== undefined) {
                    profile.instagram = Sanitizer.sanitizeString(args.input.instagram);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                }
                if (args.input.applyLink !== undefined) {
                    profile.applyLink = args.input.applyLink;
                }
                if (args.input.applyLinkEnabled !== undefined) {
                    profile.applyLinkEnabled = args.input.applyLinkEnabled;
                }
                if (args.input.alphaIsPrivate !== undefined && (isMemberOwner || isSuper)) {
                    existing.private = args.input.alphaIsPrivate;
                }
                if (args.input.autosubscribeRooms !== undefined && args.input.autosubscribeRooms !== null) {
                    existing.autosubscribeRooms = args.input.autosubscribeRooms.map(a => IDs.Conversation.parse(a));
                }

                if (args.input.betaMembersCanInvite !== undefined) {
                    existing.membersCanInvite = args.input.betaMembersCanInvite;
                }

                let editorial = (await Store.OrganizationEditorial.findById(ctx, orgId))!;

                if (args.input.alphaPublished !== undefined && isSuper) {
                    editorial.listed = !!Sanitizer.sanitizeAny(args.input.alphaPublished);
                }

                if (args.input.alphaEditorial !== undefined && isSuper) {
                    existing.editorial = !!Sanitizer.sanitizeAny(args.input.alphaEditorial);
                }

                if (args.input.alphaFeatured !== undefined && isSuper) {
                    editorial.featured = !!Sanitizer.sanitizeAny(args.input.alphaFeatured);
                }

                // Schedule indexing
                await Modules.Orgs.markForUndexing(ctx, profile.id);
                // Reindex rooms
                let orgRooms = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, orgId);
                let profiles = await Promise.all(orgRooms.map(room => Store.RoomProfile.findById(ctx, room.id)));
                for (let roomProfile of profiles) {
                    if (roomProfile) {
                        await roomProfile.invalidate();
                        await roomProfile.flush(ctx);
                    }
                }

                // Call hook
                await editorial.flush(ctx);
                await profile.flush(ctx);
                await Modules.Hooks.onOrganizationProfileUpdated(ctx, profile.id);
                if (nameChanged || photoChanged) {
                    await Modules.SocialImageModule.onOrganizationUpdated(ctx, profile.id);
                }
                return existing;
            });
        }),
        deleteOrganization: withAccount(async (parent, args, uid, oid) => {
            return Modules.Orgs.deleteOrganization(parent, uid, IDs.Organization.parse(args.id));
        }),
        createOrganization: withUser(async (ctx, args, uid) => {
            log.log(ctx, 'createOrganization', args.input);
            return await Modules.Orgs.createOrganization(ctx, uid, {
                ...args.input,
                autosubscribeRooms: args.input.autosubscribeRooms?.map(a => IDs.Conversation.parse(a))
            });
        }),
        requestOrganizationMembersExport: withUser(async (ctx, args, uid) => {
            let oid = IDs.Organization.parse(args.id);
            let isInWhiteList = ORG_MEMBERS_EXPORT_WHITELIST.includes(args.id);
            let isOrgAdmin = await Modules.Orgs.isUserAdmin(ctx, uid, oid);
            let isSuperAdmin = await Modules.Super.isSuperAdmin(ctx, uid);
            let canExport = isSuperAdmin || (isOrgAdmin && isInWhiteList);

            if (!canExport) {
                throw new AccessDeniedError();
            }

            asyncRun(async () => {
                let stream = Store.OrganizationMember.organization.stream('joined', oid, { batchSize: 100 });

                let data: string[][] = [];

                data.push(['first name', 'last name', 'email', 'phone', 'link']);

                let working = true;
                while (working) {
                    let batch = await inTx(rootCtx, async ctx2 => stream.next(ctx2));
                    if (batch.length === 0) {
                        working = false;
                        continue;
                    }
                    let settings = await inTx(rootCtx, async ctx2 => (await Promise.all(batch.map(v => Store.UserSettings.findById(ctx2, v.uid)))).filter(isDefined));
                    let profiles = await inTx(rootCtx, async ctx2 => (await Promise.all(batch.map(v => Store.UserProfile.findById(ctx2, v.uid)))).filter(isDefined));
                    let users = await inTx(rootCtx, async ctx2 => (await Promise.all(batch.map(v => Store.User.findById(ctx2, v.uid)))).filter(isDefined));
                    let ignoreUsers = new Set<number>(settings.filter(s => s.privacy?.communityAdminsCanSeeContactInfo === false).map(s => s.id));

                    for (let user of users) {
                        if (ignoreUsers.has(user.id)) {
                            continue;
                        }
                        let profile = profiles.find(p => p.id === user.id);
                        if (!profile) {
                            continue;
                        }

                        data.push([
                            profile.firstName,
                            profile.lastName || '-',
                            user.email || '-',
                            user.phone || '-',
                            `openland.com/${IDs.User.serialize(user.id)}`
                        ]);
                    }
                }

                let csv = '';
                for (let line of data) {
                    csv += line.map(v => `"${v}"`).join(';') + '\n';
                }

                let supportUserId = await inTx(rootCtx, async ctx2 => await Modules.Super.getEnvVar<number>(ctx2, 'support-user-id'));
                if (!supportUserId) {
                    return;
                }

                let res = await Modules.Media.upload(rootCtx, Buffer.from(csv), '.csv');
                log.log(ctx, 'export file:', res);
                let fileMetadata = await Modules.Media.saveFile(rootCtx, res.file);
                let attachment = {
                    type: 'file_attachment',
                    fileId: res.file,
                    fileMetadata
                } as MessageAttachmentFileInput;

                log.log(ctx, 'export', attachment);
                try {
                    await inTx(rootCtx, async ctx2 => {
                        let conv = await Modules.Messaging.room.resolvePrivateChat(ctx2, ctx.auth.uid!, supportUserId!);
                        let orgProfile = (await Store.OrganizationProfile.findById(ctx, oid))!;
                        log.log(ctx, 'export sending message');
                        await Modules.Messaging.sendMessage(
                            ctx2,
                            conv.id,
                            supportUserId!,
                            {
                                ...buildMessage('Member list for ', orgMention(orgProfile.name, oid)),
                                attachments: [attachment]
                            },
                            true
                        );
                    });
                } catch (e) {
                    log.log(rootCtx, 'export_error', e);
                }
            });

            return true;
        }),
    }
};
