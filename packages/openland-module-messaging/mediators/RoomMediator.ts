import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomRepository } from 'openland-module-messaging/repositories/RoomRepository';
import { RoomProfileInput } from 'openland-module-messaging/RoomProfileInput';

@injectable()
export class RoomMediator {
    @lazyInject('RoomRepository')
    private readonly repo!: RoomRepository;

    async isRoomMember(uid: number, cid: number) {
        return await this.repo.isActiveMember(uid, cid);
    }

    async createRoom(kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, message?: string) {
        return await this.repo.createRoom(kind, oid, uid, members, profile, message);
    }

    async inviteToRoom(cid: number, uid: number, invites: number[]) {
        return await this.repo.inviteToRoom(cid, uid, invites);
    }

    async kickFromRoom(cid: number, uid: number, kickedUid: number) {
        if (uid === kickedUid) {
            return await this.repo.leaveRoom(cid, uid);
        } else {
            return await this.repo.kickFromRoom(cid, uid, kickedUid);
        }
    }

    async leaveRoom(cid: number, uid: number) {
        return await this.repo.leaveRoom(cid, uid);
    }

    async joinRoom(cid: number, uid: number) {
        return await this.repo.joinRoom(cid, uid);
    }

    async updateRoomProfile(cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await this.repo.updateRoomProfile(cid, uid, profile);
    }

    async updateMemberRole(cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await this.repo.updateMemberRole(cid, uid, updatedUid, role);
    }

    async resolvePrivateChat(uid1: number, uid2: number) {
        return await this.repo.resolvePrivateChat(uid1, uid2);
    }

    async resolveOrganizationChat(oid: number) {
        return await this.repo.resolveOrganizationChat(oid);
    }

    async findConversationMembers(cid: number): Promise<number[]> {
        return await this.repo.findConversationMembers(cid);
    }

    async resolveConversationTitle(conversationId: number, uid: number): Promise<string> {
        return await this.repo.resolveConversationTitle(conversationId, uid);
    }

    async resolveConversationPhoto(conversationId: number, uid: number): Promise<string | null> {
        return await this.repo.resolveConversationPhoto(conversationId, uid);
    }

    async checkAccess(uid: number, cid: number) {
        return await this.repo.checkAccess(uid, cid);
    }

    async setFeatured(cid: number, featued: boolean) {
        return await this.repo.setFeatured(cid, featued);
    }

    async setListed(cid: number, listed: boolean) {
        return await this.repo.setListed(cid, listed);
    }

    async roomMembersCount(conversationId: number, status?: string): Promise<number> {
        return await this.repo.roomMembersCount(conversationId, status);
    }

    async findMembershipStatus(uid: number, cid: number) {
        return await this.repo.findMembershipStatus(uid, cid);
    }
}