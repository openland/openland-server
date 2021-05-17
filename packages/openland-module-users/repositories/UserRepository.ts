import { inTx } from '@openland/foundationdb';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { ProfileInput } from 'openland-module-users/ProfileInput';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { UserProfileShape, UserSettingsShape } from 'openland-module-db/store';
import { Modules } from 'openland-modules/Modules';
import { uuid } from '../../openland-utils/uuid';
import { notifyFastWatch } from '../../openland-module-db/fastWatch';
import { ensure, onlyOneOfKeys } from '../../openland-utils/InputValidator';
import { IDs } from '../../openland-module-api/IDs';
import { UserSettingsSnapshot } from 'openland-module-users/UsersModule';

export type AuthInfo = {
    email?: string,
    googleId?: string
    phone?: string
};

type CustomStatusInput = {
    emoji: string | undefined | null
    text: string | undefined | null
};

type BadgeStatusInput = {
    id: number
};

export type StatusInput = {
    custom?: CustomStatusInput | undefined | null
    badge?: BadgeStatusInput | undefined | null
};

const buildStatus = async (ctx: Context, uid: number, input: StatusInput | null): Promise<UserProfileShape['modernStatus']> => {
    if (!input) {
        return null;
    }

    ensure(input, onlyOneOfKeys()).throw('Status should have only one field');

    if (input.badge && await Modules.Users.badges.isBadgeAdded(ctx, uid, input.badge.id)) {
        return {
            type: 'badge',
            id: input.badge.id
        };
    }
    if (input.custom) {
        return {
            type: 'custom',
            text: input.custom.text!,
            emoji: input.custom.emoji || null
        };
    }
    throw new Error('Invalid input');
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
                status: 'activated',
                invitedBy: null,
                isSuperBot: null,
                botOwner: null,
                ...(authInfo.email ? { email: authInfo.email.toLocaleLowerCase() } : {}),
                ...(authInfo.googleId ? { googleId: authInfo.googleId } : {}),
                ...(authInfo.phone ? { phone: authInfo.phone } : {})
            }));

            await res.flush(ctx);
            return res;
        });
    }

    async deleteUser(parent: Context, uid: number) {
        return await inTx(parent, async ctx => {
            let user = (await Store.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }

            // Delete user
            user.status = 'deleted';
            await user.flush(ctx);
            await this.markForIndexing(ctx, uid);

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

    async createUserProfile(ctx: Context, uid: number, input: ProfileInput) {
        let user = (await Store.User.findById(ctx, uid))!;
        let existing = await Store.UserProfile.findById(ctx, user.id!);
        if (existing) {
            return existing;
        }

        await validate(stringNotEmpty('Please enter your first name'), input.firstName, 'input.firstName');

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
            modernStatus: await buildStatus(ctx, uid, input.status || null),
            birthDay: input.birthDay?.getTime(),
        });
        await profile.flush(ctx);
        await this.markForIndexing(ctx, uid);
        // Events.UserProfileCreated.event(ctx, { uid: uid });
        return profile;
    }

    async updateUserProfile(ctx: Context, uid: number, input: ProfileInput) {
        let user = await Store.User.findById(ctx, uid);
        if (!user) {
            throw new NotFoundError('Unable to find user');
        }

        let profile = await Modules.Users.profileById(ctx, uid);
        let nameChanged = false;
        let photoChanged = false;
        if (!profile) {
            throw Error('Unable to find profile');
        }
        if (input.firstName !== undefined) {
            await validate(
                stringNotEmpty('Please enter your first name'),
                input.firstName,
                'input.firstName'
            );
            profile.firstName = Sanitizer.sanitizeString(input.firstName)!;
            nameChanged = true;
        }
        if (input.lastName !== undefined) {
            profile.lastName = Sanitizer.sanitizeString(input.lastName);
            nameChanged = true;
        }
        if (input.location !== undefined) {
            profile.location = Sanitizer.sanitizeString(input.location);
        }
        if (input.website !== undefined) {
            profile.website = Sanitizer.sanitizeString(input.website);
        }
        if (input.about !== undefined) {
            profile.about = Sanitizer.sanitizeString(input.about);
            await Modules.Stats.onAboutChange(ctx, uid);
        }
        if (input.photoRef !== undefined) {
            if (input.photoRef !== null) {
                await Modules.Media.saveFile(ctx, input.photoRef.uuid);
            }
            profile.picture = Sanitizer.sanitizeImageRef(input.photoRef);
            photoChanged = true;
        }
        if (input.phone !== undefined) {
            profile.phone = Sanitizer.sanitizeString(input.phone);
        }
        if (input.email !== undefined) {
            profile.email = Sanitizer.sanitizeString(input.email);
        }

        if (input.linkedin !== undefined) {
            profile.linkedin = Sanitizer.sanitizeString(input.linkedin);
        }

        if (input.instagram !== undefined) {
            profile.instagram = Sanitizer.sanitizeString(input.instagram);
        }

        if (input.twitter !== undefined) {
            profile.twitter = Sanitizer.sanitizeString(input.twitter);
        }

        if (input.facebook !== undefined) {
            profile.facebook = Sanitizer.sanitizeString(input.facebook);
        }

        if (input.primaryOrganization !== undefined) {
            if (input.primaryOrganization === null) {
                profile.primaryOrganization = null;
            } else {
                let oid = IDs.Organization.parse(input.primaryOrganization);
                let org = await Store.Organization.findById(ctx, oid);
                if (org && org.kind === 'organization') {
                    profile.primaryOrganization = IDs.Organization.parse(input.primaryOrganization);
                }
            }
        }
        if (input.birthDay !== undefined) {
            if (!input.birthDay) {
                profile.birthDay = null;
            } else {
                profile.birthDay = input.birthDay!.getTime();
            }
        }
        if (input.status !== undefined) {
            profile.modernStatus = await buildStatus(ctx, uid, input.status);
        }

        return {
            profile,
            nameChanged,
            photoChanged
        };
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
        return user.id;
    }

    async createTestUser(parent: Context, key: string, name: string) {
        return await inTx(parent, async (ctx) => {
            let email = `test-user-${key}@openland.com`;
            let user = await this.createUser(ctx, { email });
            await this.createUserProfile(ctx, user.id, { firstName: name, email });
            return user.id;
        });
    }

    /*
     * User Settings
     */

    async getUserSettingsEntity(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let settings = await Store.UserSettings.findById(ctx, uid);
            if (!settings) {
                settings = await Store.UserSettings.create(ctx, uid, this.getDefaultSettings());
            }
            return settings;
        });
    }

    async getUserSettings(ctx: Context, uid: number): Promise<UserSettingsSnapshot> {
        let settings = await Store.UserSettings.findById(ctx, uid);
        if (!settings) {
            return { id: uid, ...this.getDefaultSettings(), version: 0 };
        }
        return {
            id: uid,
            emailFrequency: settings.emailFrequency,
            desktopNotifications: settings.desktopNotifications,
            mobileNotifications: settings.mobileNotifications,
            mobileAlert: settings.mobileAlert,
            mobileIncludeText: settings.mobileIncludeText,
            notificationsDelay: settings.notificationsDelay,
            commentNotifications: settings.commentNotifications,
            commentNotificationsDelivery: settings.commentNotificationsDelivery,
            globalCounterType: settings.globalCounterType,
            desktop: settings.desktop,
            mobile: settings.mobile,
            privacy: settings.privacy,
            version: settings.metadata.versionCode
        };
    }

    private getDefaultSettings(): Omit<UserSettingsShape, 'id'> {
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
        return {
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
        };
    }

    notifyUserSettingsChanged = async (parent: Context, uid: number) => {
        await inTx(parent, async (ctx) => {
            let settings = await this.getUserSettingsEntity(ctx, uid);
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

    //
    // Tools
    //
    async markForIndexing(parent: Context, uid: number) {
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
