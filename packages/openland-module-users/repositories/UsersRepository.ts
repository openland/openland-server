import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { ImageRef } from 'openland-server/repositories/Media';
import { validate, stringNotEmpty } from 'openland-server/modules/NewInputValidator';
import { Sanitizer } from 'openland-server/modules/Sanitizer';
import { User } from 'openland-server/tables';

export class UserRepository {
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

    async createUserProfile(user: User, input: {
        firstName: string,
        lastName?: string | null,
        photoRef?: ImageRef | null,
        phone?: string | null,
        email?: string | null,
        website?: string | null,
        about?: string | null,
        location?: string | null
    }) {
        return await inTx(async () => {
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
}