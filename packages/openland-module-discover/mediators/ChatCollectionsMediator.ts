import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { ChatCollectionInput, ChatCollectionsRepository } from '../repositories/ChatCollectionsRepository';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

@injectable()
export class ChatCollectionsMediator {
    @lazyInject('ChatCollectionsRepository')
    private readonly repo!: ChatCollectionsRepository;

    async createCollection(parent: Context, uid: number, input: ChatCollectionInput) {
        return await inTx(parent, async ctx => {
            await this.checkAccess(ctx, uid);
            return this.repo.createCollection(ctx, uid, input);
        });
    }

    async updateCollection(parent: Context, uid: number, collectionId: number, input: Partial<ChatCollectionInput>) {
        return await inTx(parent, async ctx => {
            await this.checkAccess(ctx, uid);
            return this.repo.updateCollection(ctx, collectionId, input);
        });
    }

    async deleteCollection(parent: Context, uid: number, collectionId: number) {
        return await inTx(parent, async ctx => {
            await this.checkAccess(ctx, uid);
            return this.repo.deleteCollection(ctx, collectionId);
        });
    }

    private async checkAccess(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
            if (!isSuperAdmin) {
                throw new AccessDeniedError();
            }
        });
    }
}
