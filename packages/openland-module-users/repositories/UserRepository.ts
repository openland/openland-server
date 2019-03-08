import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { ProfileInput } from 'openland-module-users/ProfileInput';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context } from 'openland-utils/Context';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Modules } from '../../openland-modules/Modules';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';

const userCreated = createHyperlogger<{ uid: number }>('user_created');
const userProfileCreated = createHyperlogger<{ uid: number }>('user_profile_created');

@injectable()
export class UserRepository {
    private readonly userAuthIdCache = new Map<string, number | undefined>();
    
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    /*
     * User
     */

    async createUser(parent: Context, authId: string, email: string) {
        return await inTx(parent, async (ctx) => {

            // Build next user id sequence number
            let seq = (await this.entities.Sequence.findById(ctx, 'user-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create(ctx, 'user-id', { value: 0 });
            }
            let id = ++seq.value;
            await seq.flush();

            let res = (await this.entities.User.create(ctx, id, { authId: authId, email: email.toLowerCase(), isBot: false, status: 'pending' }));
            await res.flush();
            await userCreated.event(ctx, { uid: id });
            return res;
        });
    }

    async activateUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = (await this.entities.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            if (user.status !== 'activated') {
                user.status = 'activated';
                return true;
            } else {
                return false;
            }
        });
    }

    async suspendUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = (await this.entities.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            user.status = 'suspended';
            return user;
        });
    }

    async deleteUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let user = (await this.entities.User.findById(ctx, uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            user.status = 'deleted';
            return user;
        });
    }

    /*
     * Profile
     */

    async findUserProfile(ctx: Context, uid: number) {
        return this.entities.UserProfile.findById(ctx, uid);
    }

    async createUserProfile(parent: Context, uid: number, input: ProfileInput) {
        return await inTx(parent, async (ctx) => {
            let user = (await this.entities.User.findById(ctx, uid))!;
            let existing = await this.entities.UserProfile.findById(ctx, user.id!);
            if (existing) {
                return existing;
            }

            await validate(
                stringNotEmpty('First name can\'t be empty!'),
                input.firstName,
                'input.firstName'
            );

            // Create pfofile
            let profile = await this.entities.UserProfile.create(ctx, user.id!, {
                firstName: Sanitizer.sanitizeString(input.firstName)!,
                lastName: Sanitizer.sanitizeString(input.lastName),
                picture: Sanitizer.sanitizeImageRef(input.photoRef),
                phone: Sanitizer.sanitizeString(input.phone),
                email: Sanitizer.sanitizeString(input.email) || user.email,
                website: Sanitizer.sanitizeString(input.website),
                about: Sanitizer.sanitizeString(input.about),
                location: Sanitizer.sanitizeString(input.location)
            });
            await profile.flush();
            await this.markForUndexing(ctx, uid);
            await userProfileCreated.event(ctx, { uid: uid });
            await Modules.Hooks.onUserProfileCreated(ctx, uid);
            return profile;
        });
    }

    /*
     * Bots
     */

    async createSystemBot(ctx: Context, key: string, name: string, photoRef: ImageRef) {
        let user = await this.createUser(ctx, 'system-bot|' + key, 'hello@openland.com');
        await this.createUserProfile(ctx, user.id, { firstName: name, photoRef: photoRef, email: 'hello@openland.com' });
        await this.activateUser(ctx, user.id);
        return user.id;
    }

    async createTestUser(ctx: Context, key: string, name: string) {
        let user = await this.createUser(ctx, 'test-user|' + key, 'hello@openland.com');
        await this.createUserProfile(ctx, user.id, { firstName: name, email: 'hello@openland.com' });
        await this.activateUser(ctx, user.id);
        return user.id;
    }

    /*
     * User Settings
     */

    async getUserSettings(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let settings = await this.entities.UserSettings.findById(ctx, uid);
            if (!settings) {
                settings = await this.entities.UserSettings.create(ctx, uid, {
                    emailFrequency: '1hour',
                    desktopNotifications: 'all',
                    mobileNotifications: 'all',
                    mobileAlert: true,
                    mobileIncludeText: true,
                    notificationsDelay: 'none'
                });
            }
            return settings;
        });
    }

    async waitForNextSettings(ctx: Context, uid: number) {
        await new Promise<number>((resolver) =>
            this.entities.UserSettings.watch(ctx, uid, () => {
                resolver();
            })
        );
    }

    /*
     * Profile Prefill
     */

    async findProfilePrefill(ctx: Context, uid: number) {
        return this.entities.UserProfilePrefil.findById(ctx, uid);
    }

    async saveProfilePrefill(parent: Context, uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entities.UserProfilePrefil.findById(ctx, uid);
            if (!existing) {
                await this.entities.UserProfilePrefil.create(ctx, uid, {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture
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
            let exists = (await this.entities.User.findAll(ctx)).find((v) => v.authId === authId);
            if (exists != null) {
                if (!this.userAuthIdCache.has(authId)) {
                    this.userAuthIdCache.set(authId, exists.id!!);
                }
                return exists.id;
            } else {
                if (!this.userAuthIdCache.has(authId)) {
                    this.userAuthIdCache.set(authId, undefined);
                }
                return undefined;
            }
        }
    }

    //
    // Tools
    //
    async markForUndexing(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.UserIndexingQueue.findById(ctx, uid);
            if (existing) {
                existing.markDirty();
            } else {
                await this.entities.UserIndexingQueue.create(ctx, uid, {});
            }
        });
    }
}