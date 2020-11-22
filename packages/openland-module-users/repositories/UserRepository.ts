import { Events } from 'openland-module-hyperlog/Events';
import { inTx } from '@openland/foundationdb';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { ProfileInput } from 'openland-module-users/ProfileInput';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { fetchNextDBSeq } from 'openland-utils/dbSeq';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { Store } from 'openland-module-db/FDB';
import { UserBadge } from 'openland-module-db/store';
import { Modules } from 'openland-modules/Modules';
import { uuid } from '../../openland-utils/uuid';
import { notifyFastWatch } from '../../openland-module-db/fastWatch';

export type AuthInfo = {
    email?: string,
    googleId?: string
    phone?: string
};

@injectable()
export class UserRepository {
    private readonly userAuthIdCache = new Map<string, number | undefined>();

    /*
     * User
     */

    async createUser(parent: Context, authInfo: AuthInfo) {
        return await inTx(parent, async (ctx) => {
            if (!authInfo.email && !authInfo.googleId && !authInfo.phone) {
                throw new Error(`Can\'t create user without auth info`);
            }

            // Build next user id sequence number
            let seq = (await Store.Sequence.findById(ctx, 'user-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'user-id', { value: 0 });
            }
            let id = ++seq.value;
            await seq.flush(ctx);

            let res = (await Store.User.create(ctx, id, {
                authId: uuid(),
                isBot: false,
                status: 'pending',
                invitedBy: null,
                isSuperBot: null,
                botOwner: null,
                ...(authInfo.email ? { email: authInfo.email.toLocaleLowerCase() } : {}),
                ...(authInfo.googleId ? { googleId: authInfo.googleId } : {}),
                ...(authInfo.phone ? { phone: authInfo.phone } : {})
            }));

            await res.flush(ctx);
            Events.UserCreated.event(ctx, { uid: id });
            return res;
        });
    }

    async activateUser(parent: Context, uid: number, invitedBy: number | null = null) {
        return await inTx(parent, async (ctx) => {
            let user = (await Store.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            if (user.status !== 'activated') {
                user.status = 'activated';
                user.invitedBy = user.invitedBy || invitedBy;
                await user.flush(ctx);
                await this.markForUndexing(ctx, uid);
                Events.UserActivated.event(ctx, { uid, isTest: await Modules.Users.isTest(ctx, user.id) });
                return true;
            } else {
                return false;
            }
        });
    }

    async suspendUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = (await Store.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            user.status = 'suspended';
            await user.flush(ctx);
            await this.markForUndexing(ctx, uid);
            return user;
        });
    }

    async deleteUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = (await Store.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }

            // Delete user
            user.status = 'deleted';
            await user.flush(ctx);
            await this.markForUndexing(ctx, uid);

            // Revoke tokens
            await Modules.Auth.revokeUserTokens(ctx, uid);

            // Leave organizations
            let membership = await Store.OrganizationMember.user.findAll(ctx, 'joined', uid);
            await Promise.all(membership.map(m => Modules.Orgs.removeUserFromOrganiaztionWithoutAccessChecks(ctx, uid, m.oid)));

            // Leave chats
            let participates = await Store.RoomParticipant.userActive.findAll(ctx, uid);
            await Promise.all(participates.map(p => Modules.Messaging.room.leaveRoom(ctx, p.cid, uid, false)));

            // Free shortname
            await Modules.Shortnames.freeShortName(ctx, 'user', uid);

            return user;
        });
    }

    async findUser(ctx: Context, uid: number) {
        return Store.User.findById(ctx, uid);
    }

    /*
     * Profile
     */

    async findUserProfile(ctx: Context, uid: number) {
        return Store.UserProfile.findById(ctx, uid);
    }

    async createUserProfile(parent: Context, uid: number, input: ProfileInput) {
        return await inTx(parent, async (ctx) => {
            let user = (await Store.User.findById(ctx, uid))!;
            let existing = await Store.UserProfile.findById(ctx, user.id!);
            if (existing) {
                return existing;
            }

            await validate(
                stringNotEmpty('Please enter your first name'),
                input.firstName,
                'input.firstName',
            );

            // Create pfofile
            let profile = await Store.UserProfile.create(ctx, user.id!, {
                firstName: Sanitizer.sanitizeString(input.firstName)!,
                lastName: Sanitizer.sanitizeString(input.lastName),
                picture: Sanitizer.sanitizeImageRef(input.photoRef),
                phone: Sanitizer.sanitizeString(input.phone),
                email: Sanitizer.sanitizeString(input.email) || user.email,
                website: Sanitizer.sanitizeString(input.website),
                about: Sanitizer.sanitizeString(input.about),
                location: Sanitizer.sanitizeString(input.location),
                linkedin: null,
                instagram: null,
                twitter: null,
                facebook: null,
                locations: null,
                primaryOrganization: null,
                primaryBadge: null,
                role: null,
            });
            await profile.flush(ctx);
            await this.markForUndexing(ctx, uid);
            Events.UserProfileCreated.event(ctx, { uid: uid });
            return profile;
        });
    }

    async bindInvitedBy(parent: Context, uid: number, inviteKey: string) {
        await inTx(parent, async ctx => {
            let user = (await Store.User.findById(ctx, uid));
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            let invite = await Modules.Invites.resolveInvite(ctx, inviteKey);
            if (invite) {
                user.invitedBy = invite.creatorId;
            }
        });
    }

    /*
     * Bots
     */

    async createSystemBot(ctx: Context, key: string, name: string, photoRef: ImageRef) {
        let user = await this.createUser(ctx, { email: 'hello@openland.com' });
        await this.createUserProfile(ctx, user.id, {
            firstName: name,
            photoRef: photoRef,
            email: 'hello@openland.com',
        });
        await this.activateUser(ctx, user.id);
        return user.id;
    }

    async createTestUser(parent: Context, key: string, name: string) {
        return await inTx(parent, async (ctx) => {
            let email = `test-user-${key}@openland.com`;
            let user = await this.createUser(ctx, { email });
            await this.createUserProfile(ctx, user.id, { firstName: name, email });
            await this.activateUser(ctx, user.id);
            return user.id;
        });
    }

    /*
     * User Settings
     */

    async getUserSettings(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let settings = await Store.UserSettings.findById(ctx, uid);
            if (!settings) {
                let allChatEnabled = {
                    sound: true,
                    showNotification: true
                };
                let allPlatformEnabled = {
                    comments: allChatEnabled,
                    secretChat: allChatEnabled,
                    direct: allChatEnabled,
                    communityChat: allChatEnabled,
                    organizationChat: allChatEnabled,
                    channels: allChatEnabled,
                    notificationPreview: 'name_text' as any,
                };
                settings = await Store.UserSettings.create(ctx, uid, {
                    emailFrequency: '1hour',
                    desktopNotifications: 'all',
                    mobileNotifications: 'all',
                    mobileAlert: true,
                    mobileIncludeText: true,
                    notificationsDelay: 'none',
                    commentNotifications: 'all',
                    commentNotificationsDelivery: 'all',
                    globalCounterType: 'unread_chats',
                    desktop: allPlatformEnabled,
                    mobile: allPlatformEnabled,
                    privacy: {
                        whoCanSeeEmail: 'nobody',
                        whoCanSeePhone: 'nobody',
                        communityAdminsCanSeeContactInfo: true,
                        whoCanAddToGroups: 'everyone'
                    }
                });
            }
            return settings;
        });
    }

    notifyUserSettingsChanged = async (parent: Context, uid: number) => {
        await inTx(parent, async (ctx) => {
            let settings = await this.getUserSettings(ctx, uid);
            settings.invalidate();
            notifyFastWatch(ctx, 'user-settings-' + uid);
        });
    }

    async waitForNextSettings(ctx: Context, uid: number) {
        let w = await inTx(ctx, async (ctx2) => Store.UserSettings.watch(ctx2, uid));
        await w.promise;
    }

    /*
     * Profile Prefill
     */

    async findProfilePrefill(ctx: Context, uid: number) {
        return Store.UserProfilePrefil.findById(ctx, uid);
    }

    async saveProfilePrefill(parent: Context, uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        await inTx(parent, async (ctx) => {
            let existing = await Store.UserProfilePrefil.findById(ctx, uid);
            if (!existing) {
                await Store.UserProfilePrefil.create(ctx, uid, {
                    firstName: prefill.firstName ? prefill.firstName : null,
                    lastName: prefill.lastName ? prefill.lastName : null,
                    picture: prefill.picture ? prefill.picture : null,
                });
            }
        });
    }

    /**
     * Queries
     */
    async findUserByAuthId(ctx: Context, authId: string): Promise<number | undefined> {
        if (this.userAuthIdCache.has(authId)) {
            return this.userAuthIdCache.get(authId);
        } else {
            const user = await Store.User.authId.find(ctx, authId);

            if (user === null) {
                return;
            }

            if (!this.userAuthIdCache.has(authId)) {
                this.userAuthIdCache.set(authId, user.id);
            }
            return user.id;

        }
    }

    /**
     * Badges
     */
    async createBadge(parent: Context, uid: number, name: string, isSuper: boolean, cid?: number) {
        return await inTx(parent, async (ctx) => {
            let badgeName = name.trim();

            if (badgeName.length <= 0) {
                throw new Error('Description can\'t be empty');
            }

            if (badgeName.length > 40) {
                throw new Error('Max length: 40 characters');
            }

            let userBadge = await Store.UserBadge.create(ctx, await fetchNextDBSeq(parent, 'badge-id'), {
                uid,
                name: badgeName,
                verifiedBy: null,
                deleted: null
            });
            await userBadge.flush(ctx);

            if (cid) {
                await this.updateRoomBadge(ctx, uid, cid, userBadge.id);
            } else {
                if (!isSuper) {
                    // set primary if needed
                    let userBadges = (await Store.UserBadge.user.query(ctx, uid, { limit: 2 })).items;

                    if (userBadges.length === 1) {
                        let profile = await Store.UserProfile.findById(ctx, uid);

                        if (profile && !profile.primaryBadge) {
                            profile.primaryBadge = userBadge.id;

                            await profile.flush(ctx);
                        }
                    }
                }
            }
            return userBadge;
        });
    }

    async deleteBadge(parent: Context, uid: number, bid: number, skipAccessCheck: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let userBadge = await Store.UserBadge.findById(ctx, bid);
            let profile = await Store.UserProfile.findById(ctx, uid);

            if (!userBadge || !profile) {
                throw new NotFoundError();
            }

            if (!skipAccessCheck && userBadge.uid !== uid) {
                throw new AccessDeniedError();
            }

            userBadge.deleted = true;

            await userBadge.flush(ctx);

            // unset primary if needed
            if (profile.primaryBadge === bid) {
                profile.primaryBadge = null;

                await profile.flush(ctx);
            }

            return uid;
        });
    }

    async updatePrimaryBadge(parent: Context, uid: number, bid: number | null) {
        return await inTx(parent, async (ctx) => {
            let profile = await Store.UserProfile.findById(ctx, uid);

            if (!profile) {
                throw new NotFoundError();
            }

            if (bid === null) {
                profile.primaryBadge = null;
                await profile.flush(ctx);
                return uid;
            }

            let userBadge = await Store.UserBadge.findById(ctx, bid);

            if (!userBadge) {
                throw new NotFoundError();
            }

            if (userBadge.uid !== uid) {
                throw new AccessDeniedError();
            }

            profile.primaryBadge = bid;
            await profile.flush(ctx);

            return uid;
        });
    }

    async verifyBadge(parent: Context, bid: number, by: number | null) {
        return await inTx(parent, async (ctx) => {
            let userBadge = await Store.UserBadge.findById(ctx, bid);

            if (!userBadge) {
                throw new NotFoundError();
            }

            userBadge.verifiedBy = by;
            await userBadge.flush(ctx);

            return userBadge.uid;
        });
    }

    async updateRoomBadge(parent: Context, uid: number, cid: number, bid: number | null) {
        return await inTx(parent, async (ctx) => {
            let roomBadge = await Store.UserRoomBadge.findById(ctx, uid, cid);

            if (roomBadge) {
                if (bid === null && roomBadge.bid) {
                    await this.deleteBadge(ctx, uid, roomBadge.bid, true);
                    roomBadge.bid = bid;
                } else {
                    roomBadge.bid = bid;
                }
            } else {
                await Store.UserRoomBadge.create(ctx, uid, cid, {
                    bid: bid,
                });
            }
            return bid ? (await Store.UserBadge.findById(ctx, bid))! : null;
        });
    }

    async getUserBadge(ctx: Context, uid: number, cid?: number, ignorePrimary?: boolean) {
        const getPrimaryBadge = async () => {
            if (ignorePrimary !== true) {
                let profile = await Store.UserProfile.findById(ctx, uid);

                if (profile && profile.primaryBadge) {
                    return await Store.UserBadge.findById(ctx, profile.primaryBadge);
                }
            }
            return null;
        };
        const fetchBadge = (badge: UserBadge | null) => (badge && !badge.deleted) ? badge : null;

        if (!cid) {
            return fetchBadge(await getPrimaryBadge());
        }
        let userRoomBadge = await Store.UserRoomBadge.findById(ctx, uid, cid);
        if (userRoomBadge && userRoomBadge.bid) {
            return fetchBadge(await Store.UserBadge.findById(ctx, userRoomBadge.bid));
        } else {
            return fetchBadge(await getPrimaryBadge());
        }
    }

    //
    // Tools
    //
    async markForUndexing(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.UserIndexingQueue.findById(ctx, uid);
            if (existing) {
                existing.invalidate();
            } else {
                await Store.UserIndexingQueue.create(ctx, uid, {});
            }
        });
    }
}
