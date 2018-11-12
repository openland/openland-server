import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { ProfileInput } from 'openland-module-users/ProfileInput';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { ImageRef } from 'openland-module-media/ImageRef';

export class UserRepository {
    private readonly userAuthIdCache = new Map<string, number | undefined>();
    private entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    /*
     * User
     */

    async createUser(authId: string, email: string) {
        return await inTx(async () => {

            // Build next user id sequence number
            let seq = (await this.entities.Sequence.findById('user-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create('user-id', { value: 0 });
            }
            let id = ++seq.value;
            await seq.flush();

            let res = (await this.entities.User.create(id, { authId: authId, email: email.toLowerCase(), isBot: false, status: 'pending' }));
            await res.flush();
            return res;
        });
    }

    async activateUser(uid: number) {
        return await inTx(async () => {
            let user = (await this.entities.User.findById(uid))!;
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

    async suspendUser(uid: number) {
        return await inTx(async () => {
            let user = (await this.entities.User.findById(uid))!;
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            user.status = 'suspended';
            return user;
        });
    }

    /*
     * Profile
     */

    async findUserProfile(uid: number) {
        return this.entities.UserProfile.findById(uid);
    }

    async createUserProfile(uid: number, input: ProfileInput) {
        return await inTx(async () => {
            let user = (await this.entities.User.findById(uid))!;
            let existing = await this.entities.UserProfile.findById(user.id!);
            if (existing) {
                return existing;
            }

            await validate(
                stringNotEmpty('First name can\'t be empty!'),
                input.firstName,
                'input.firstName'
            );

            // Create pfofile
            return await this.entities.UserProfile.create(user.id!, {
                firstName: Sanitizer.sanitizeString(input.firstName)!,
                lastName: Sanitizer.sanitizeString(input.lastName),
                picture: Sanitizer.sanitizeImageRef(input.photoRef),
                phone: Sanitizer.sanitizeString(input.phone),
                email: Sanitizer.sanitizeString(input.email) || user.email,
                website: Sanitizer.sanitizeString(input.website),
                about: Sanitizer.sanitizeString(input.about),
                location: Sanitizer.sanitizeString(input.location)
            });
        });
    }

    /*
     * Bots
     */
    
    async createSystemBot(key: string, name: string, photoRef: ImageRef) {
        let user = await this.createUser('system-bot|' + key, 'hello@openland.com');
        await this.createUserProfile(user.id, { firstName: name, photoRef: photoRef, email: 'hello@openland.com' });
        await this.activateUser(user.id);
        return user.id;
    }

    /*
     * User Settings
     */

    async getUserSettings(uid: number) {
        return await inTx(async () => {
            let settings = await this.entities.UserSettings.findById(uid);
            if (!settings) {
                settings = await this.entities.UserSettings.create(uid, {
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

    async waitForNextSettings(uid: number) {
        await new Promise<number>((resolver) =>
            this.entities.UserSettings.watch(uid, () => {
                resolver();
            })
        );
    }

    /*
     * Profile Prefill
     */

    async findProfilePrefill(uid: number) {
        return this.entities.UserProfilePrefil.findById(uid);
    }

    async saveProfilePrefill(uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        await inTx(async () => {
            let existing = await this.entities.UserProfilePrefil.findById(uid);
            if (!existing) {
                await this.entities.UserProfilePrefil.create(uid, {
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
    async findUserByAuthId(authId: string): Promise<number | undefined> {
        if (this.userAuthIdCache.has(authId)) {
            return this.userAuthIdCache.get(authId);
        } else {
            let exists = (await this.entities.User.findAll()).find((v) => v.authId === authId);
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
}