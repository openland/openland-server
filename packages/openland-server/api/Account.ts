import { DB } from '../tables';
import { CallContext } from './utils/CallContext';
import { withUser, withAny, withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { IDs } from './utils/IDs';
import { buildBaseImageUrl, ImageRef } from '../repositories/Media';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { OrganizationInviteLink, OrganizationPublicInviteLink } from 'openland-module-db/schema';

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
            let invite: { oid: number, uid: number, ttl?: number | null, role?: string, joined?: boolean, email?: string, firstName?: string } | null = orgInvite || publicOrginvite;
            if (!invite) {
                return null;
            }
            let org = await DB.Organization.findById(invite.oid);
            if (!org) {
                return null;
            }
            return {
                id: args.key,
                key: args.key,
                orgId: IDs.Organization.serialize(org.id!!),
                title: org.name,
                photo: org.photo ? buildBaseImageUrl(org.photo) : null,
                photoRef: org.photo,
                joined: !!invite.joined,
                creator: invite.uid ? await DB.User.findOne({ where: { id: invite.uid } }) : null,
                forEmail: invite.email,
                forName: invite.firstName,
            };
        }),
        appInviteInfo: withAny<{ key: string }>(async (args, context: CallContext) => {
            let invite = await Modules.Invites.repo.getInvteLinkData(args.key);
            if (!invite) {
                return null;
            }
            let inviter = await DB.User.findById(invite.uid);
            return {
                inviter: inviter,
            };
        }),
        appInvite: withUser(async (args, uid) => {
            return await Modules.Invites.repo.getInviteLinkKey(uid);
        }),
        // depricated. todo: delete
        alphaAppInviteInfo: withAny<{ key: string }>(async (args, context: CallContext) => {
            let invite = await Modules.Invites.repo.getInvteLinkData(args.key);
            if (!invite) {
                return null;
            }
            let inviter = await DB.User.findById(invite.uid);
            return {
                inviter: inviter,
            };
        }),
        // depricated. todo: delete
        alphaAppInvite: withUser(async (args, uid) => {
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
            let res = await DB.User.findById(context.uid);
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
            let organization = !!context.oid ? await DB.Organization.findById(context.oid) : null;
            let isOrganizationPicked = organization !== null;
            let orgsIDs = await Repos.Users.fetchUserAccounts(context.uid);
            let isOrganizationExists = orgsIDs.length > 0;

            // Stage 3: Activation Status
            let orgs = await DB.Organization.findAll({ where: { id: { $in: orgsIDs } } });
            let isAllOrganizationsSuspended = orgs.length > 0 && orgs.filter(o => o.status === 'SUSPENDED').length === orgs.length;
            let isActivated = orgs.filter(o => o.status === 'ACTIVATED').length > 0;
            // depricated
            let isOrganizationActivated = isOrganizationPicked && organization!!.status !== 'PENDING';

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
            return await DB.txStable(async (tx) => {
                await inTx(async () => {
                    let orgInvite = await Modules.Invites.repo.getOrganizationInviteNonJoined(args.key);
                    let publicOrginvite = await Modules.Invites.repo.getPublicOrganizationInviteByKey(args.key);
                    let invite: { oid: number, uid: number, ttl?: number | null, role?: string } | null = orgInvite || publicOrginvite;

                    if (!invite) {
                        throw new NotFoundError(ErrorText.unableToFindInvite);
                    }
                    let existing = await DB.OrganizationMember.find({
                        where: {
                            userId: uid,
                            orgId: invite.oid
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (existing) {
                        return IDs.Organization.serialize(invite.oid);
                    }

                    if (invite.ttl && (new Date().getTime() >= invite.ttl)) {
                        throw new NotFoundError(ErrorText.unableToFindInvite);
                    }
                    await DB.OrganizationMember.create({
                        userId: uid,
                        orgId: invite.oid,
                        isOwner: invite.role === 'OWNER',
                        invitedBy: invite.uid
                    }, { transaction: tx });

                    // make organization primary if none
                    let profile = (await Modules.Users.profileById(uid));
                    if (profile && !profile.primaryOrganization) {
                        profile.primaryOrganization = invite!.oid;
                    }

                    let user = (await DB.User.findById(uid, { transaction: tx }))!;
                    // User set invitedBy if none
                    user.invitedBy = user.invitedBy === undefined ? invite.uid : user.invitedBy;
                    user.status = 'ACTIVATED';
                    await user.save({ transaction: tx });

                    await Repos.Chats.addToInitialChannel(user.id!, tx);

                    // invalidate invite
                    if (orgInvite) {
                        orgInvite.joined = true;
                    }
                    return IDs.Organization.serialize(invite.oid);

                });

            });
        }),
        joinAppInvite: withAny<{ key: string }>(async (args, context) => {
            let uid = context.uid;
            if (uid === undefined) {
                return;
            }
            return await DB.txStable(async (tx) => {
                let inviteData = await Modules.Invites.repo.getInvteLinkData(args.key);
                if (!inviteData) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                let user = (await DB.User.findById(uid, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
                // activate user, set invited by
                user.invitedBy = inviteData.uid;
                user.status = 'ACTIVATED';
                await user.save({ transaction: tx });
                await Repos.Chats.addToInitialChannel(user.id!, tx);
                // activate user org if have one
                let org = context.oid ? (await DB.Organization.findById(context.oid, { transaction: tx, lock: tx.LOCK.UPDATE })) : undefined;
                if (org) {
                    org.status = 'ACTIVATED';
                    await org.save({ transaction: tx });
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
            return await DB.txLight(async (tx) => {
                let userProfile = await Repos.Users.createUser(uid, args.user, tx);
                let organization = await Repos.Organizations.createOrganization(uid, { ...args.organization, personal: false }, tx);

                return {
                    user: userProfile,
                    organization: organization
                };
            });
        }),
    }
};