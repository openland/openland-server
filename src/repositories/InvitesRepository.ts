import { randomKey } from '../utils/random';
import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError';
import { OrganizationInvite } from '../tables/OrganizationInvite';

const SECS_IN_DAY = 60 * 60 * 24;

const DEFAULT_ONE_TIME_TTL = SECS_IN_DAY * 7;

export default class InvitesRepository {

    public async createOneTimeInvite(
        orgId: number,
        creatorId: number,
        firstName: string,
        lastName: string,
        forEmail: string,
        role: 'MEMBER' | 'OWNER',
        tx?: Transaction
    ): Promise<OrganizationInvite> {
        return await DB.OrganizationInvite.create({
            uuid: randomKey(),
            orgId,
            creatorId,
            memberFirstName: firstName,
            memberLastName: lastName,
            forEmail,
            ttl: new Date().getTime() + DEFAULT_ONE_TIME_TTL,
            isOneTime: true,
            memberRole: role
        }, { transaction: tx });
    }

    public async revokeOneTimeInvite(orgId: number, inviteId: number, tx?: Transaction) {
        let invite = await DB.OrganizationInvite.findOne({
            where: {
                orgId,
                id: inviteId,
                isOneTime: true
            },
            transaction: tx
        });

        if (!invite) {
            throw new NotFoundError();
        }

        await invite.destroy({ transaction: tx });
    }

    public async haveInviteForEmail(orgId: number, email: string|null|undefined, tx?: Transaction): Promise<boolean> {
        let invite = await DB.OrganizationInvite.findOne({
            where: {
                orgId,
                forEmail: email,
                isOneTime: true
            },
            transaction: tx
        });

        return !!invite;
    }

    public async getOneTimeInvites(orgId: number, tx?: Transaction): Promise<OrganizationInvite[]> {
        let invites = await DB.OrganizationInvite.findAll({
            where: {
                orgId,
                isOneTime: true
            },
            transaction: tx
        });

        return invites;
    }
}