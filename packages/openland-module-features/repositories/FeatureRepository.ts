import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-errors/UserError';
import { Context } from 'openland-utils/Context';

export class FeatureRepository {
    private entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async enableFeatureForOrganization(parent: Context, oid: number, featureKey: string) {
        await inTx(parent, async (ctx) => {
            if (!await this.entities.FeatureFlag.findById(ctx, featureKey)) {
                throw new UserError('Unable to find feature');
            }
            let ex = await this.entities.OrganizationFeatures.findFromOrganization(ctx, oid, featureKey);
            if (ex) {
                ex.enabled = true;
            } else {
                await this.entities.OrganizationFeatures.create(ctx, await this.entities.connection.nextRandomId(), { organizationId: oid, featureKey, enabled: true });
            }
        });
    }

    async disableFeatureForOrganization(parent: Context, oid: number, featureKey: string) {
        await inTx(parent, async (ctx) => {
            if (!await this.entities.FeatureFlag.findById(ctx, featureKey)) {
                throw new UserError('Unable to find feature');
            }
            let ex = await this.entities.OrganizationFeatures.findFromOrganization(ctx, oid, featureKey);
            if (ex) {
                ex.enabled = false;
            }
        });
    }

    async findAllFeatures(ctx: Context) {
        return await this.entities.FeatureFlag.findAll(ctx);
    }

    async findOrganizationFeatures(ctx: Context, oid: number) {
        return (await this.entities.OrganizationFeatures.allFromOrganization(ctx, oid)).filter((v) => v.enabled);
    }

    async findOrganizationFeatureFlags(ctx: Context, oid: number) {
        return Promise.all((await this.findOrganizationFeatures(ctx, oid)).map(async orgFeature => await this.entities.FeatureFlag.findById(ctx, orgFeature.featureKey)));
    }

    async createFeatureFlag(parent: Context, key: string, title: string) {
        return await inTx(parent, async (ctx) => await this.entities.FeatureFlag.create(ctx, key, { title }));
    }
}