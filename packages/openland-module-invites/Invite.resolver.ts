import { OrganizationInviteLink, OrganizationPublicInviteLink } from 'openland-module-db/schema';
import { withUser, withAny, withAccount } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { AuthContext } from 'openland-module-auth/AuthContext';

export default {
    Invite: {
        id: (src: OrganizationInviteLink | OrganizationPublicInviteLink) => src.id,
        key: (src: OrganizationInviteLink | OrganizationPublicInviteLink) => src.id,
        ttl: (src: OrganizationInviteLink | OrganizationPublicInviteLink) => String((src as any).ttl)
    },
    Query: {
        alphaInvites: withUser(async (args, uid) => {
            return [];
        }),
        alphaInviteInfo: withAny<{ key: string }>(async (ctx, args) => {
            let orgInvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteNonJoined(args.key);
            let publicOrginvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteLinkByKey(args.key);
            let invite: { oid: number, uid: number, ttl?: number | null, role?: string, joined?: boolean, email?: string, firstName?: string | null } | null = orgInvite || publicOrginvite;
            if (!invite) {
                return null;
            }
            let org = await FDB.Organization.findById(invite.oid);
            if (!org) {
                return null;
            }
            let profile = (await FDB.OrganizationProfile.findById(invite.oid))!;
            return {
                id: args.key,
                key: args.key,
                orgId: IDs.Organization.serialize(org.id!!),
                title: profile.name,
                photo: profile.photo ? buildBaseImageUrl(profile.photo) : null,
                photoRef: profile.photo,
                joined: !!invite.joined,
                creator: invite.uid ? await FDB.User.findById(invite.uid) : null,
                forEmail: invite.email,
                forName: invite.firstName,
            };
        }),
        appInviteInfo: withAny<{ key: string }>(async (ctx, args) => {
            let invite = await Modules.Invites.orgInvitesRepo.getAppInvteLinkData(args.key);
            if (!invite) {
                return null;
            }
            let inviter = await FDB.User.findById(invite.uid);
            return {
                inviter: inviter,
            };
        }),
        appInvite: withUser(async (ctx, args, uid) => {
            return await Modules.Invites.orgInvitesRepo.getAppInviteLinkKey(uid);
        }),
        // deperecated
        alphaInvitesHistory: withUser(async (args, uid) => {
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
    },
    Mutation: {
        alphaJoinInvite: withUser<{ key: string }>(async (ctx, args, uid) => {
            return await Modules.Invites.joinOrganizationInvite(uid, args.key);
        }),
        joinAppInvite: withAny<{ key: string }>(async (ctx, args) => {
            let uid = AuthContext.get(ctx).uid;
            if (uid === undefined) {
                return;
            }
            return await Modules.Invites.joinAppInvite(uid, args.key);
        }),

        // deperecated
        alphaCreateInvite: withAccount(async (args, uid, oid) => {
            // return await DB.OrganizationInvite.create({
            //     uuid: randomKey(),
            //     orgId: oid,
            //     creatorId: uid
            // });
        }),

        // deperecated
        alphaDeleteInvite: withAccount<{ id: string }>(async (args, uid, oid) => {
            // await DB.OrganizationInvite.destroy({
            //     where: {
            //         orgId: oid,
            //         id: IDs.Invite.parse(args.id)
            //     }
            // });
            // return 'ok';
        })
    }
};