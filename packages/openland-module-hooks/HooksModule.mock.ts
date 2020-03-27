import { injectable } from 'inversify';
import { Context } from '@openland/context';
import {
    WalletPurchaseCreateShape,
    WalletSubscriptionCreateShape,
} from '../openland-module-db/store';

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

    onFirstOrganizationActivated = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number } | { type: 'BY_INVITE', inviteType: 'APP' | 'ROOM' } | { type: 'OWNER_ADDED_TO_ORG', owner: number, otherOid: number }) => {
        // Nothing to do
    }

    onOrganizationSuspended = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number }) => {
        // Nothing to do
    }

    onSignUp = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onUserProfileCreated = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onUserActivated = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onChatMembersCountChange = async (ctx: Context, cid: number, delta: number) => {
        // Nothing to do
    }

    onDialogsLoad = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onMessageSent = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onNewMobileUser = async (ctx: Context) => {
        // Nothing to do
    }

    onEmailSent = async (ctx: Context, uid: number) => {
        // Nothing to do
    }

    onRoomLeave = async (ctx: Context, cid: number, uid: number, wasKicked: boolean) => {
        // Nothing to do
    }

    onRoomJoin = async (ctx: Context, cid: number, uid: number, by: number) => {
        // Nothing to do
    }

    onOrgJoin = async (ctx: Context, oid: number, uid: number) => {
        // Nothing to do
    }

    onSubscriptionPaymentSuccess = async (ctx: Context, uid: number, amount: number, product: WalletSubscriptionCreateShape['proudct']) => {
        // Nothing to do
    }

    onPurchaseSuccess = async (ctx: Context, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        // Nothing to do
    }

    onRoomCreate = async (ctx: Context, uid: number, cid: number, price: number, kind: 'group' | 'public') => {
        // Nothing to do
    }
}