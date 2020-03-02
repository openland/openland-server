import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Modules } from '../../openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { EditorsChoiceChatInput, EditorsChoiceChatsRepository } from '../repositories/EditorsChoiceChatsRepository';

@injectable()
export class EditorsChoiceChatsMediator {
    @lazyInject('EditorsChoiceChatsRepository')
    private readonly repo!: EditorsChoiceChatsRepository;

    async createChat(parent: Context, uid: number, input: EditorsChoiceChatInput) {
        return await inTx(parent, async ctx => {
            await this.checkAccess(ctx, uid);
            return this.repo.createChat(ctx, uid, input);
        });
    }

    async updateChat(parent: Context, uid: number, id: number, input: Partial<EditorsChoiceChatInput>) {
        return await inTx(parent, async ctx => {
            await this.checkAccess(ctx, uid);
            return this.repo.updateChat(ctx, id, input);
        });
    }

    async deleteChat(parent: Context, uid: number, id: number) {
        return await inTx(parent, async ctx => {
            await this.checkAccess(ctx, uid);
            return this.repo.deleteChat(ctx, id);
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
