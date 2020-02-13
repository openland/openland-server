import {
    ChannelInvitation,
    ChannelLink,
    OrganizationInviteLink,
    OrganizationPublicInviteLink
} from 'openland-module-db/store';
import { withUser, withAny, withAccount, withActivatedUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { IDs, IdsFactory } from 'openland-module-api/IDs';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Context } from '@openland/context';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

async function resolveOrgInvite(ctx: Context, key: string) {
    let orgInvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteNonJoined(ctx, key);
    let publicOrginvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteLinkByKey(ctx, key);
    let invite: { oid: number, uid: number, enabled: boolean | null, ttl?: number | null, role?: string, joined?: boolean | null, email?: string, firstName?: string | null } | null = orgInvite || publicOrginvite;
    if (!invite) {
        return null;
    }
    if (!invite.enabled) {
        return null;
    }
    let org = await Store.Organization.findById(ctx, invite.oid);
    if (!org) {
        return null;
    }
    let profile = (await Store.OrganizationProfile.findById(ctx, invite.oid))!;

    let membersCount = await Modules.Orgs.organizationMembersCount(ctx, invite.oid);

    return {
        id: key,
        key: key,
        orgId: IDs.Organization.serialize(org.id!!),
        title: profile.name,
        photo: profile.photo ? buildBaseImageUrl(profile.photo) : null,
        photoRef: profile.photo,
        joined: !!invite.joined,
        membersCount: membersCount,
        creator: invite.uid ? await Store.User.findById(ctx, invite.uid) : null,
        forEmail: invite.email,
        forName: invite.firstName,
        description: profile.about,
        organization: org,
    };
}

export const Resolver: GQLResolver = {
    InviteInfo: {
        id: src => src.id,
        key: src => src.key,
        orgId: src => src.orgId,
        title: src => src.title,
        photo: src => src.photo,
        photoRef: src => src.photoRef,
        joined: src => src.joined,
        membersCount: src => src.membersCount,
        creator: src => src.creator,
        forEmail: src => src.forEmail,
        forName: src => src.forName,
        description: src => src.description,
        organization: src => src.organization,
    },
    Invite: {
        id: (src: OrganizationInviteLink | OrganizationPublicInviteLink) => src.id,
        key: (src: OrganizationInviteLink | OrganizationPublicInviteLink) => src.id,
        ttl: (src: OrganizationInviteLink | OrganizationPublicInviteLink) => String((src as any).ttl)
    },
    ResolveInviteEntry: {
        __resolveType: obj => {
            if (obj instanceof ChannelInvitation || obj instanceof ChannelLink) {
                return 'RoomInvite';
            } else if (obj.type === 'org') {
                return 'InviteInfo';
            } else if (obj.type === 'app') {
                return 'AppInvite';
            }

            throw new Error('Unknown invite type');
        }
    },
    Query: {
        alphaInvites: withUser(async (ctx, args, uid) => {
            return [];
        }),
        alphaInviteInfo: withAny(async (ctx, args) => {
            return await resolveOrgInvite(ctx, args.key);
        }),
        appInviteInfo: withAny(async (ctx, args) => {
            let invite = await Modules.Invites.orgInvitesRepo.getAppInvteLinkData(ctx, args.key);
            if (!invite) {
                return null;
            }
            let inviter = await Store.User.findById(ctx, invite.uid);
            return {
                inviter: inviter,
            };
        }),
        appInvite: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Invites.orgInvitesRepo.getAppInviteLinkKey(ctx, uid);
        }),
        appInviteFromUser: withActivatedUser(async (ctx, args) => {
            let uid: number|undefined;
            try {
                let idInfo = IdsFactory.resolve(args.shortname);
                if (idInfo.type === IDs.User) {
                    uid = idInfo.id as number;
                }
            } catch {
                let shortname = await Modules.Shortnames.findShortname(ctx, args.shortname);
                if (shortname) {
                    if (shortname.ownerType === 'user') {
                        uid = shortname.ownerId;
                    }
                }
            }
            if (!uid) {
                throw new NotFoundError();
            }
            return await Modules.Invites.orgInvitesRepo.getAppInviteLinkKey(ctx, uid);
        }),
        // deperecated
        alphaInvitesHistory: withUser(async (ctx, args, uid) => {
            // let invites = await DB.OrganizationInvite.findAll({ where: { creatorId: uid, isOneTime: true }, order: [['createdAt', 'DESC']] });
            // return invites.map(async (invite) => {
            //     return ({
            //         acceptedBy: invite.acceptedById ? await DB.User.findOne({ where: { id: invite.acceptedById } }) : null,
            //         forEmail: invite.forEmail,
            //         isGlobal: invite.type === 'for_organization',
            //     });
            // });
            return [];
        }),
        alphaResolveInvite: withAny(async (ctx, args) => {
            let orgInvite = await resolveOrgInvite(ctx, args.key);

            if (orgInvite) {
                return {
                    type: 'org',
                    ...orgInvite
                };
            }

            let appInvite = await Modules.Invites.orgInvitesRepo.getAppInvteLinkData(ctx, args.key);

            if (appInvite) {
                let inviter = await Store.User.findById(ctx, appInvite.uid);
                return {
                    type: 'app',
                    inviter: inviter,
                };
            }

            let roomInvite = await Modules.Invites.resolveInvite(ctx, args.key);

            if (roomInvite) {
                return roomInvite;
            }

            return null;
        }),
    },
    Mutation: {
        alphaJoinInvite: withUser(async (ctx, args, uid) => {
            return await Modules.Invites.joinOrganizationInvite(ctx, uid, args.key, (args.isNewUser !== null && args.isNewUser !== undefined) ? args.isNewUser : false);
        }),
        joinAppInvite: withAny(async (ctx, args) => {
            let uid = AuthContext.get(ctx).uid;
            if (uid === undefined) {
                throw new AccessDeniedError();
            }
            return await Modules.Invites.joinAppInvite(ctx, uid, args.key, (args.isNewUser !== null && args.isNewUser !== undefined) ? args.isNewUser : false);
        }),

        // deperecated
        alphaCreateInvite: withAccount(async (ctx, args, uid, oid) => {
            // return await DB.OrganizationInvite.create({
            //     uuid: randomKey(),
            //     orgId: oid,
            //     creatorId: uid
            // });
        }),

        // deperecated
        alphaDeleteInvite: withAccount(async (ctx, args, uid, oid) => {
            // await DB.OrganizationInvite.destroy({
            //     where: {
            //         orgId: oid,
            //         id: IDs.Invite.parse(args.id)
            //     }
            // });
            // return 'ok';
            return 'deprecated';
        })
    }
};
