import { DB } from 'openland-server/tables';
import { UpdateReader } from 'openland-server/modules/updateReader';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

export function startMigration() {
    let reader = new UpdateReader('export_user_profiles', 2, DB.UserProfile);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let existing = await Modules.Users.profileById(i.userId!);
                if (!existing) {
                    await FDB.UserProfile.create(i.userId!, {
                        firstName: i.firstName,
                        lastName: i.lastName,
                        phone: i.phone,
                        about: i.about,
                        website: i.website,
                        location: i.location,
                        email: i.email,
                        picture: i.picture,
                        linkedin: i.extras && i.extras.linkedin,
                        twitter: i.extras && i.extras.twitter,
                        locations: i.extras && i.extras.locations,
                        primaryOrganization: i.extras && i.extras.primaryOrganization,
                        role: i.extras && i.extras.role
                    });
                }
            });
        }
    });
    reader.start();
}