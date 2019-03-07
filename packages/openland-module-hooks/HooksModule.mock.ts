import { injectable } from 'inversify';
import { Context } from '../openland-utils/Context';

@injectable()
export class HooksModuleMock {
    
    start = () => {
        // Nothing to do
    }

    onUserProfileUpdated = async (uid: number) => {
        // Nothing to do
    }

    onOrganizationProfileUpdated = async (oid: number) => {
        // Nothing to do
    }

    onOrganizationCreated = async (uid: number, oid: number) => {
        // Nothing to do
    }

    onUserJoined = async (uid: number, oid: number) => {
        // Nothing to do
    }

    onUserRemoved = async (uid: number, oid: number) => {
        // Nothing to do
    }

    onOrganizationActivated = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number } | { type: 'BY_INVITE', inviteType: 'APP' | 'ROOM' } | { type: 'OWNER_ADDED_TO_ORG', owner: number, otherOid: number }) => {
        // Nothing to do
    }

    onOrganizationSuspended = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number }) => {
        // Nothing to do
    }
}