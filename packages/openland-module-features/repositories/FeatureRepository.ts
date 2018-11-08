import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-errors/UserError';

export class FeatureRepository {
    private entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async enableFeatureForOrganization(oid: number, featureKey: string) {
        await inTx(async () => {
            if (!await this.entities.FeatureFlag.findById(featureKey)) {
                throw new UserError('Unable to find feature');
            }
            let ex = await this.entities.OrganizationFeatures.findFromOrganization(oid, featureKey);
            if (ex) {
                ex.enabled = true;
            } else {
                await this.entities.OrganizationFeatures.create(await this.entities.connection.nextRandomId(), { organizationId: oid, featureKey, enabled: true });
            }
        });
    }

    async disableFeatureForOrganization(oid: number, featureKey: string) {
        await inTx(async () => {
            if (!await this.entities.FeatureFlag.findById(featureKey)) {
                throw new UserError('Unable to find feature');
            }
            let ex = await this.entities.OrganizationFeatures.findFromOrganization(oid, featureKey);
            if (ex) {
                ex.enabled = false;
            }
        });
    }

    async findAllFeatures() {
        return await this.entities.FeatureFlag.findAll();
    }

    async findOrganizationFeatures(oid: number) {
        return (await this.entities.OrganizationFeatures.allFromOrganization(oid)).filter((v) => v.enabled);
    }

    async findOrganizationFeatureFlags(oid: number) {
        return (await this.findOrganizationFeatures(oid)).map(async orgFeature => await this.entities.FeatureFlag.findById(orgFeature.featureKey));
    }

    async createFeatureFlag(key: string, title: string) {
        return await inTx(async () => await this.entities.FeatureFlag.create(key, { title }));
    }
}