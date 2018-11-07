import { CallContext } from './utils/CallContext';
import { withUser, withAny, withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { IDs } from './utils/IDs';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { OrganizationInviteLink, OrganizationPublicInviteLink } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl, ImageRef } from 'openland-module-media/ImageRef';

export const Resolver = {
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
        sessionState: async function (_: any, args: {}, context: CallContext) {

            // If there are no user in the context
            if (!context.uid) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isActivated: false,
                    isAccountExists: false,
                    isCompleted: false,
                    isBlocked: false,
                    // depricated
                    isAccountPicked: false,
                    isAccountActivated: false,
                };
            }

            // User unknown?! Just softly ignore errors
            let res = await FDB.User.findById(context.uid);
            if (res === null) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isActivated: false,
                    isAccountExists: false,
                    isCompleted: false,
                    isBlocked: false,
                    // depricated
                    isAccountPicked: false,
                    isAccountActivated: false,
                };
            }

            // State 0: Is Logged In
            let isLoggedIn = true; // Checked in previous steps

            // Stage 1: Create Profile
            let profile = context.uid ? (await Modules.Users.profileById(context.uid)) : null;
            let isProfileCreated = !!profile;

            // Stage 2: Pick organization or create a new one (if there are no exists)
            let organization = !!context.oid ? await FDB.Organization.findById(context.oid) : null;
            let isOrganizationPicked = organization !== null;
            let orgsIDs = await Repos.Users.fetchUserAccounts(context.uid);
            let isOrganizationExists = orgsIDs.length > 0;

            // Stage 3: Activation Status
            let orgs = await Promise.all(orgsIDs.map((v) => FDB.Organization.findById(v)));
            let isAllOrganizationsSuspended = orgs.length > 0 && orgs.filter(o => o!.status === 'suspended').length === orgs.length;
            let isActivated = orgs.filter(o => o!.status === 'activated').length > 0;
            // depricated
            let isOrganizationActivated = isOrganizationPicked && organization!!.status !== 'pending';

            let queryResult = {
                isLoggedIn: isLoggedIn,
                isProfileCreated: isProfileCreated,
                isActivated: isActivated,
                isAccountExists: isOrganizationExists,
                isCompleted: isProfileCreated && isOrganizationExists && isOrganizationPicked && isActivated,
                isBlocked: isAllOrganizationsSuspended,
                // depricated
                isAccountPicked: isOrganizationPicked,
                isAccountActivated: isOrganizationActivated,
            };

            return queryResult;
        },
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
                user.status = 'activated';

                await Repos.Chats.addToInitialChannel(user.id!);

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
                await Repos.Chats.addToInitialChannel(user.id!);
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
        }),
        alphaCreateUserProfileAndOrganization: withUser<{
            user: {
                firstName: string,
                lastName?: string | null,
                photoRef?: ImageRef | null,
                phone?: string | null,
                email?: string | null,
                website?: string | null,
                about?: string | null,
                location?: string | null
            },
            organization: {
                name: string,
                website?: string | null
                personal: boolean
                photoRef?: ImageRef | null
            }
        }>(async (args, uid) => {
            return await inTx(async () => {
                let userProfile = await Repos.Users.createUser(uid, args.user);
                let organization = await Repos.Organizations.createOrganization(uid, { ...args.organization, personal: false });

                return {
                    user: userProfile,
                    organization: organization
                };
            });
        }),
    }
};