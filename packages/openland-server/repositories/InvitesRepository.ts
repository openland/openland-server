import { randomGlobalInviteKey, randomInviteKey } from '../utils/random';
import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { NotFoundError } from '../errors/NotFoundError';
import { OrganizationInvite } from '../tables/OrganizationInvite';

const SECS_IN_DAY = 60 * 60 * 24;

const DEFAULT_ONE_TIME_TTL = 7; // 7 days

export default class InvitesRepository {

    public async createOneTimeInvite(
        orgId: number,
        creatorId: number,
        firstName: string,
        lastName: string,
        forEmail: string,
        emailText: string,
        role: 'MEMBER' | 'OWNER',
        tx?: Transaction
    ): Promise<OrganizationInvite> {
        return await DB.OrganizationInvite.create({
            uuid: randomInviteKey(),
            orgId,
            creatorId,
            memberFirstName: firstName,
            memberLastName: lastName,
            forEmail,
            ttl: this.createTTLvalue(DEFAULT_ONE_TIME_TTL),
            isOneTime: true,
            memberRole: role,
            emailText,
            type: 'for_member'
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
                isOneTime: true,
                type: 'for_member',
                acceptedById: null
            },
            transaction: tx
        });

        return !!invite;
    }

    public async getOneTimeInvites(orgId: number, tx?: Transaction): Promise<OrganizationInvite[]> {
        let invites = await DB.OrganizationInvite.findAll({
            where: {
                orgId,
                isOneTime: true,
                type: 'for_member',
                acceptedById: null
            },
            transaction: tx
        });

        return invites;
    }

    public async getPublicInvite(orgId: number, tx?: Transaction): Promise<OrganizationInvite|null> {
        return await DB.OrganizationInvite.findOne({
            where: {
                isOneTime: false,
                type: 'for_member',
                orgId
            },
            transaction: tx
        });
    }

    public async deletePublicInvite(orgId: number, tx?: Transaction): Promise<void> {
        await DB.OrganizationInvite.destroy({
            where: {
                isOneTime: false,
                type: 'for_member',
                orgId
            },
            transaction: tx
        });
    }

    public async createPublicInvite(orgId: number, expirationDays?: number, tx?: Transaction): Promise<OrganizationInvite> {
        await this.deletePublicInvite(orgId, tx);

        return await DB.OrganizationInvite.create({
            isOneTime: false,
            orgId,
            uuid: randomInviteKey(),
            ttl: expirationDays ? this.createTTLvalue(expirationDays) : undefined,
            type: 'for_member'
        });
    }

    public async createOneTimeInviteForOrg(
        fromOrgId: number,
        creatorId: number,
        firstName: string,
        lastName: string,
        forEmail: string,
        emailText: string,
        tx?: Transaction
    ): Promise<OrganizationInvite> {
        return await DB.OrganizationInvite.create({
            uuid: randomGlobalInviteKey(),
            orgId: fromOrgId,
            creatorId,
            memberFirstName: firstName,
            memberLastName: lastName,
            forEmail,
            ttl: this.createTTLvalue(DEFAULT_ONE_TIME_TTL),
            isOneTime: true,
            emailText,
            type: 'for_organization'
        }, { transaction: tx });
    }

    public async haveOrganizationInviteForEmail(orgId: number, email: string|null|undefined, tx?: Transaction): Promise<boolean> {
        let invite = await DB.OrganizationInvite.findOne({
            where: {
                orgId,
                forEmail: email,
                isOneTime: true,
                type: 'for_organization',
                acceptedById: null
            },
            transaction: tx
        });

        return !!invite;
    }

    public async getPublicInviteForOrganizations(orgId: number, tx?: Transaction) {
        return await DB.OrganizationInvite.findOne({
            where: {
                isOneTime: false,
                type: 'for_organization',
                orgId
            },
            transaction: tx
        });
    }

    public async createPublicInviteForOrganizations(orgId: number, expirationDays?: number, tx?: Transaction): Promise<OrganizationInvite> {
        await this.deletePublicInviteForOrganizations(orgId, tx);

        return await DB.OrganizationInvite.create({
            isOneTime: false,
            orgId,
            uuid: randomGlobalInviteKey(),
            ttl: expirationDays ? this.createTTLvalue(expirationDays) : undefined,
            type: 'for_organization'
        });
    }

    public async deletePublicInviteForOrganizations(orgId: number, tx?: Transaction) {
        await DB.OrganizationInvite.destroy({
            where: {
                isOneTime: false,
                type: 'for_organization',
                orgId
            },
            transaction: tx
        });
    }

    private createTTLvalue(expirationDays: number): number {
        return new Date().getTime() + (SECS_IN_DAY * 1000 * expirationDays);
    }
}