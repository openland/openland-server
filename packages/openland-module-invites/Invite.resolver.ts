import { OrganizationInviteLink, OrganizationPublicInviteLink } from 'openland-module-db/schema';
import { withUser, withAny, withAccount } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-module-api/CallContext';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { inTx } from 'foundation-orm/inTx';
import { ErrorText } from 'openland-errors/ErrorText';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { Emails } from '../openland-module-email/Emails';

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
        alphaInviteInfo: withAny<{ key: string }>(async (args, context: CallContext) => {
            let orgInvite = await Modules.Invites.repo.getOrganizationInviteNonJoined(args.key);
            let publicOrginvite = await Modules.Invites.repo.getPublicOrganizationInviteByKey(args.key);
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
        appInviteInfo: withAny<{ key: string }>(async (args, context: CallContext) => {
            let invite = await Modules.Invites.repo.getInvteLinkData(args.key);
            if (!invite) {
                return null;
            }
            let inviter = await FDB.User.findById(invite.uid);
            return {
                inviter: inviter,
            };
        }),
        appInvite: withUser(async (args, uid) => {
            return await Modules.Invites.repo.getInviteLinkKey(uid);
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
        alphaJoinInvite: withUser<{ key: string }>(async (args, uid) => {
            return await inTx(async () => {
                let orgInvite = await Modules.Invites.repo.getOrganizationInviteNonJoined(args.key);
                let publicOrginvite = await Modules.Invites.repo.getPublicOrganizationInviteByKey(args.key);
                let invite: { oid: number, uid: number, ttl?: number | null, role?: string } | null = orgInvite || publicOrginvite;

                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                // TODO: Better handling?
                let existing = await FDB.OrganizationMember.findById(invite.oid, uid);
                if (existing && existing.status === 'joined') {
                    return IDs.Organization.serialize(invite.oid);
                }

                if (invite.ttl && (new Date().getTime() >= invite.ttl)) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                await FDB.OrganizationMember.create(invite.oid, uid, {
                    role: invite.role === 'OWNER' ? 'admin' : 'member',
                    status: 'joined',
                    invitedBy: invite.uid
                });

                // make organization primary if none
                let profile = (await Modules.Users.profileById(uid));
                if (profile && !profile.primaryOrganization) {
                    profile.primaryOrganization = invite!.oid;
                }

                let user = (await FDB.User.findById(uid))!;
                // User set invitedBy if none
                user.invitedBy = user.invitedBy === undefined ? invite.uid : user.invitedBy;
                if (user.status !== 'activated') {
                    await Emails.sendWelcomeEmail(user!.id);
                    user.status = 'activated';
                }

                // invalidate invite
                if (orgInvite) {
                    orgInvite.joined = true;
                }
                return IDs.Organization.serialize(invite.oid);

            });
        }),
        joinAppInvite: withAny<{ key: string }>(async (args, context) => {
            let uid = context.uid;
            if (uid === undefined) {
                return;
            }
            return await inTx(async () => {
                let inviteData = await Modules.Invites.repo.getInvteLinkData(args.key);
                if (!inviteData) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                let user = (await FDB.User.findById(uid!))!;
                // activate user, set invited by
                user.invitedBy = inviteData.uid;
                user.status = 'activated';
                await Emails.sendWelcomeEmail(user!.id);
                // activate user org if have one
                let org = context.oid ? (await FDB.Organization.findById(context.oid)) : undefined;
                if (org) {
                    org.status = 'activated';
                }
                return 'ok';
            });
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