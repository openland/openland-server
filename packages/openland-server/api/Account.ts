import { DB } from '../tables';
import { CallContext } from './utils/CallContext';
import { withUser, withAny, withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { IDs } from './utils/IDs';
import { OrganizationInvite } from '../tables/OrganizationInvite';
import { randomKey } from '../utils/random';
import { buildBaseImageUrl, ImageRef } from '../repositories/Media';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { Hooks } from '../repositories/Hooks';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';

export const Resolver = {
    Invite: {
        id: (src: OrganizationInvite) => IDs.Invite.serialize(src.id),
        key: (src: OrganizationInvite) => src.uuid,
        ttl: (src: OrganizationInvite) => String(src.ttl)
    },
    Query: {
        alphaInvites: withUser(async (args, uid) => {
            return await DB.OrganizationInvite.findAll({ where: { creatorId: uid } });
        }),
        alphaInviteInfo: withAny<{ key: string }>(async (args, context: CallContext) => {
            let invite = await DB.OrganizationInvite.find({ where: { uuid: args.key, acceptedById: null } });
            if (!invite) {
                return null;
            }
            let org = await DB.Organization.findById(invite.orgId);
            if (!org) {
                return null;
            }
            let joined = invite.acceptedById !== null;
            return {
                id: IDs.InviteInfo.serialize(invite.id),
                key: args.key,
                orgId: IDs.Organization.serialize(org.id!!),
                title: org.name,
                photo: org.photo ? buildBaseImageUrl(org.photo) : null,
                photoRef: org.photo,
                joined: joined,
                creator: invite.creatorId ? await DB.User.findOne({ where: { id: invite.creatorId } }) : null,
                forEmail: invite.forEmail,
                forName: invite.memberFirstName,
            };
        }),
        alphaInvitesHistory: withUser(async (args, uid) => {
            let invites = await DB.OrganizationInvite.findAll({ where: { creatorId: uid, isOneTime: true }, order: [['createdAt', 'DESC']] });
            return invites.map(async (invite) => {
                return ({
                    acceptedBy: invite.acceptedById ? await DB.User.findOne({ where: { id: invite.acceptedById } }) : null,
                    forEmail: invite.forEmail,
                    isGlobal: invite.type === 'for_organization',
                });
            });
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
                let invite = await DB.OrganizationInvite.find({
                    where: {
                        uuid: args.key,
                        type: 'for_member',
                        acceptedById: null
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });

                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                let existing = await DB.OrganizationMember.find({
                    where: {
                        userId: uid,
                        orgId: invite.orgId
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });
                if (existing) {
                    return IDs.Organization.serialize(invite.orgId);
                }

                if (invite.ttl && (new Date().getTime() >= invite.ttl)) {
                    await invite.destroy({ transaction: tx });
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }
                if (invite.isOneTime) {
                    await DB.OrganizationMember.create({
                        userId: uid,
                        orgId: invite.orgId,
                        isOwner: invite.memberRole === 'OWNER',
                        invitedBy: invite.creatorId
                    }, { transaction: tx });

                    invite.acceptedById = uid;
                    await invite.save({ transaction: tx });
                } else {
                    await DB.OrganizationMember.create({
                        userId: uid,
                        orgId: invite.orgId,
                        isOwner: false,
                        invitedBy: invite.creatorId
                    }, { transaction: tx });
                }

                // make organization primary if none
                await inTx(async () => {
                    let profile = (await Modules.Users.profileById(uid));
                    if (profile && !profile.primaryOrganization) {
                        profile.primaryOrganization = invite!!.orgId;
                    }
                });

                // User set invitedBy if none
                if (invite.creatorId) {
                    let user = await DB.User.find({
                        where: {
                            id: uid,
                            invitedBy: null
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (user) {
                        user.invitedBy = invite.creatorId;
                        await user.save({ transaction: tx });
                    }
                }

                await Hooks.onUserJoined(uid, invite.orgId, tx);
                // Activate user if organizaton is ACTIVATED
                let organization = await DB.Organization.find({ where: { id: invite.orgId }, transaction: tx });
                if (organization && organization.status === 'ACTIVATED') {
                    let user = await DB.User.find({
                        where: {
                            id: uid
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (user) {
                        user.status = 'ACTIVATED';
                        await user.save({ transaction: tx });

                        await Repos.Chats.addToInitialChannel(user.id!, tx);

                    }
                }

                return IDs.Organization.serialize(invite.orgId);
            });
        }),
        alphaJoinGlobalInvite: withAny<{ key: string }>(async (args, context) => {
            let uid = context.uid;
            if (uid === undefined) {
                return;
            }
            return await DB.txStable(async (tx) => {
                let invite = await DB.OrganizationInvite.find({
                    where: {
                        uuid: args.key,
                        type: 'for_organization',
                        acceptedById: null
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });

                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }

                // User set invitedBy if none
                if (invite.creatorId) {
                    let user = await DB.User.find({
                        where: {
                            id: uid,
                            invitedBy: null
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (user) {
                        user.invitedBy = invite.creatorId;
                        await user.save({ transaction: tx });
                    }
                }

                let organization = await DB.Organization.find({ where: { id: invite.orgId }, transaction: tx });
                if (organization && organization.status === 'ACTIVATED') {
                    let user = await DB.User.find({
                        where: {
                            id: uid
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (user) {
                        user.status = 'ACTIVATED';
                        await user.save({ transaction: tx });
                        await Repos.Chats.addToInitialChannel(user.id!, tx);

                    }
                }

                if (context.oid !== undefined) {
                    // Activate organization
                    let org = await DB.Organization.find({
                        where: {
                            id: context.oid
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (org) {
                        org.status = 'ACTIVATED';
                        await org.save({ transaction: tx });
                    }
                }

                if (invite.isOneTime === true) {
                    invite.acceptedById = uid!;
                    await invite.save({ transaction: tx });
                }

                return 'ok';
            });
        }),
        alphaCreateInvite: withAccount(async (args, uid, oid) => {
            return await DB.OrganizationInvite.create({
                uuid: randomKey(),
                orgId: oid,
                creatorId: uid
            });
        }),
        alphaDeleteInvite: withAccount<{ id: string }>(async (args, uid, oid) => {
            await DB.OrganizationInvite.destroy({
                where: {
                    orgId: oid,
                    id: IDs.Invite.parse(args.id)
                }
            });
            return 'ok';
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