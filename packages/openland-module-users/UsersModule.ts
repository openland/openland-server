
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
import { ImageRef } from 'openland-server/repositories/Media';
import { User, DB } from 'openland-server/tables';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UpdateReader } from 'openland-server/modules/updateReader';
import { inTx } from 'foundation-orm/inTx';
export class UsersModule {

    private readonly repo = new UserRepository(FDB);

    start = () => {
        userProfileIndexer();

        // Import settings
        let reader = new UpdateReader('settings-import', 1, DB.UserSettings);
        reader.processor(async (items) => {
            for (let i of items) {
                await inTx(async () => {
                    let settings = await this.repo.getUserSettings(i.userId);
                    let oldSettings = i.settings;
                    if (oldSettings.emailFrequency) {
                        settings.emailFrequency = oldSettings.emailFrequency as any;
                    }
                    if (oldSettings.desktopNotifications) {
                        settings.emailFrequency = oldSettings.desktopNotifications as any;
                    }
                    if (oldSettings.mobileNotifications) {
                        settings.mobileNotifications = oldSettings.mobileNotifications as any;
                    }
                    if (oldSettings.mobileAlert !== undefined) {
                        settings.mobileAlert = oldSettings.mobileAlert as any;
                    }
                    if (oldSettings.mobileIncludeText !== undefined) {
                        settings.mobileIncludeText = oldSettings.mobileIncludeText as any;
                    }
                    if (oldSettings.notificationsDelay) {
                        settings.notificationsDelay = oldSettings.notificationsDelay as any;
                    }
                });
            }
        });
        reader.start();
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
        return await this.repo.createUserProfile(user, input);
    }

    async getUserSettings(uid: number) {
        return await this.repo.getUserSettings(uid);
    }

    async waitForNextSettings(uid: number) {
        await this.repo.waitForNextSettings(uid);
    }

    async findProfilePrefill(uid: number) {
        return this.repo.findProfilePrefill(uid);
    }

    async saveProfilePrefill(uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        return this.repo.saveProfilePrefill(uid, prefill);
    }

    async profileById(uid: number) {
        return this.repo.findUserProfile(uid);
    }
}