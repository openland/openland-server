import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { ErrorText } from 'openland-errors/ErrorText';
import { UserError } from 'openland-errors/UserError';
import { randomInviteKey } from 'openland-utils/random';
// import { DB } from 'openland-server/tables';
// import { Modules } from 'openland-modules/Modules';

// const TEMPLATE_INVITE = '024815a8-5602-4412-83f4-4be505c2026a';

export class InvitesRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async resolveInvite(id: string) {
        let ex = await this.entities.ChannelInvitation.findById(id);
        if (ex && ex.enabled && !ex.acceptedById) {
            return ex;
        }
        let ex2 = await this.entities.ChannelLink.findById(id);
        if (ex2 && ex2.enabled) {
            return ex2;
        }
        return null;
    }

    async createChannelInviteLink(channelId: number, uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.ChannelLink.allFromChannel(channelId);
            let ex = existing.find((v) => v.enabled && v.creatorId === uid);
            if (ex) {
                return ex.id;
            }
            let res = await this.entities.ChannelLink.create(randomInviteKey(), {
                channelId,
                creatorId: uid,
                enabled: true
            });
            return res.id;
        });
    }

    async refreshChannelInviteLink(channelId: number, uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.ChannelLink.allFromChannel(channelId);
            let ex = existing.find((v) => v.enabled && v.creatorId === uid);
            if (ex) {
                ex.enabled = false;
            }
            let res = await this.entities.ChannelLink.create(randomInviteKey(), {
                channelId,
                creatorId: uid,
                enabled: true
            });
            return res.id;
        });
    }

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(async () => {
            let existing = await this.entities.ChannelInvitation.allFromChannel(channelId);
            let isDuplicate = !!existing.find((v) => v.email === email && v.enabled);
            if (isDuplicate) {
                // TODO: Remove
                throw new UserError(ErrorText.inviteAlreadyExists);
            }

            let invite = await this.entities.ChannelInvitation.create(randomInviteKey(), {
                channelId,
                creatorId: uid,
                firstName: firstName,
                lastName: lastName,
                email: email,
                text: emailText,
                enabled: true
            });

            return invite;
        });
    }
}