import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { ProfileInput } from 'openland-module-users/ProfileInput';

export class UserRepository {
    private readonly userAuthIdCache = new Map<string, number | undefined>();
    private entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
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
            let existing = this.entities.UserProfilePrefil.findById(uid);
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