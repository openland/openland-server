import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-errors/UserError';

export class ShortnameRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async findShortname(shortname: string) {
        return await this.entities.ShortnameReservation.findById(this.normalizeShortname(shortname));
    }

    async findUserShortname(uid: number) {
        let existing = await this.entities.ShortnameReservation.findFromUser(uid);
        if (existing && existing.enabled) {
            return existing;
        } else {
            return null;
        }
    }

    async findOrganizationShortname(uid: number) {
        let existing = await this.entities.ShortnameReservation.findFromOrg(uid);
        if (existing && existing.enabled) {
            return existing;
        } else {
            return null;
        }
    }

    async setShortnameToUser(shortname: string, uid: number) {
        let normalized = this.normalizeShortname(shortname);
        await inTx(async () => {
            let existing = await this.entities.ShortnameReservation.findFromUser(uid);
            if (existing) {
                if (existing.shortname !== normalized) {
                    existing.enabled = false;
                    await existing.flush();
                } else {
                    return;
                }
            } else {
                let existingReservation = await this.entities.ShortnameReservation.findById(shortname);
                if (existingReservation) {
                    if ((existingReservation.ownerId === uid && existingReservation.ownerType === 'user') || !existingReservation.enabled) {
                        existingReservation.enabled = true;
                    } else {
                        throw new UserError('This shortname is already used');
                    }
                } else {
                    await this.entities.ShortnameReservation.create(shortname, { ownerId: uid, ownerType: 'user', enabled: true });
                }
            }
        });
    }

    async setShortnameToOrganization(shortname: string, oid: number) {
        let normalized = this.normalizeShortname(shortname);
        await inTx(async () => {
            let existing = await this.entities.ShortnameReservation.findFromOrg(oid);
            if (existing) {
                if (existing.shortname !== normalized) {
                    existing.enabled = false;
                    await existing.flush();
                } else {
                    return;
                }
            } else {
                let existingReservation = await this.entities.ShortnameReservation.findById(shortname);
                if (existingReservation) {
                    if ((existingReservation.ownerId === oid && existingReservation.ownerType === 'org') || !existingReservation.enabled) {
                        existingReservation.enabled = true;
                    } else {
                        throw new UserError('This shortname is already used');
                    }
                } else {
                    await this.entities.ShortnameReservation.create(shortname, { ownerId: oid, ownerType: 'org', enabled: true });
                }
            }
        });
    }

    private normalizeShortname(shortname: string) {
        // TODO: Implement correct shortname validation here
        let normalized = shortname.toLowerCase();
        if (normalized.length > 16) {
            throw Error('Shortname is too long');
        }
        if (normalized.length < 5) {
            throw Error('Shortname is too short');
        }
        if (!/^\w*$/.test(shortname)) {
            throw new UserError('Invalid shortname');
        }
        return normalized;
    }
}