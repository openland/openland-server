import { injectable } from 'inversify';

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
}