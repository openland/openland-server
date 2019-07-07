import { inTx } from '@openland/foundationdb';
import { AllEntities } from 'openland-module-db/schema';
import { ErrorText } from 'openland-errors/ErrorText';
import { UserError } from 'openland-errors/UserError';
import { randomInviteKey } from 'openland-utils/random';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class InvitesRoomRepository {
    readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async resolveInvite(ctx: Context, id: string) {
        let ex = await Store.ChannelInvitation.findById(ctx, id);
        if (ex && ex.enabled && !ex.acceptedById) {
            return ex;
        }
        let ex2 = await Store.ChannelLink.findById(ctx, id);
        if (ex2 && ex2.enabled) {
            return ex2;
        }
        return null;
    }

    async createRoomInviteLink(parent: Context, channelId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.ChannelLink.channel.findAll(ctx, channelId);
            let ex = existing.find((v) => v.enabled && v.creatorId === uid);
            if (ex) {
                return ex.id;
            }
            let res = await Store.ChannelLink.create(ctx, randomInviteKey(), {
                channelId,
                creatorId: uid,
                enabled: true
            });
            return res.id;
        });
    }

    async refreshRoomInviteLink(parent: Context, channelId: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.ChannelLink.channel.findAll(ctx, channelId);
            let ex = existing.find((v) => v.enabled && v.creatorId === uid);
            if (ex) {
                ex.enabled = false;
            }
            let res = await Store.ChannelLink.create(ctx, randomInviteKey(), {
                channelId,
                creatorId: uid,
                enabled: true
            });
            return res.id;
        });
    }

    async createChannelInvite(parent: Context, channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.ChannelInvitation.channel.findAll(ctx, channelId);
            let isDuplicate = !!existing.find((v) => v.email === email && !!v.enabled);
            if (isDuplicate) {
                // TODO: Remove
                throw new UserError(ErrorText.inviteAlreadyExists);
            }

            let invite = await Store.ChannelInvitation.create(ctx, randomInviteKey(), {
                channelId,
                creatorId: uid,
                firstName: firstName ? firstName : null,
                lastName: lastName ? lastName : null,
                email: email,
                text: emailText ? emailText : null,
                enabled: true,
                acceptedById: null
            });

            return invite;
        });
    }
}