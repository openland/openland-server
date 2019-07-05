import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { UserError } from 'openland-errors/UserError';
import { Context } from '@openland/context';
import { RandomLayer } from '@openland/foundationdb-random';

export class FeatureRepository {

    async enableFeatureForOrganization(parent: Context, oid: number, featureKey: string) {
        await inTx(parent, async (ctx) => {
            if (!await Store.FeatureFlag.findById(ctx, featureKey)) {
                throw new UserError('Unable to find feature');
            }
            let ex = await Store.OrganizationFeatures.organization.find(ctx, oid, featureKey);
            if (ex) {
                ex.enabled = true;
            } else {
                await Store.OrganizationFeatures.create(ctx, Store.storage.db.get(RandomLayer).nextRandomId(), { organizationId: oid, featureKey, enabled: true });
            }
        });
    }

    async disableFeatureForOrganization(parent: Context, oid: number, featureKey: string) {
        await inTx(parent, async (ctx) => {
            if (!await Store.FeatureFlag.findById(ctx, featureKey)) {
                throw new UserError('Unable to find feature');
            }
            let ex = await Store.OrganizationFeatures.organization.find(ctx, oid, featureKey);
            if (ex) {
                ex.enabled = false;
            }
        });
    }

    async findAllFeatures(ctx: Context) {
        return await Store.FeatureFlag.findAll(ctx);
    }

    async findOrganizationFeatures(ctx: Context, oid: number) {
        return (await Store.OrganizationFeatures.organization.findAll(ctx, oid)).filter((v) => v.enabled);
    }

    async findOrganizationFeatureFlags(ctx: Context, oid: number) {
        return Promise.all((await this.findOrganizationFeatures(ctx, oid)).map(async orgFeature => await Store.FeatureFlag.findById(ctx, orgFeature.featureKey)));
    }

    async createFeatureFlag(parent: Context, key: string, title: string) {
        return await inTx(parent, async (ctx) => await Store.FeatureFlag.create(ctx, key, { title }));
    }
}