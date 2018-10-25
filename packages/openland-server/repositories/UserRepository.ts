import { DB, User } from '../tables';
import DataLoader from 'dataloader';
import { CallContext } from '../api/utils/CallContext';
import { ImageRef } from './Media';
import { Transaction } from 'sequelize';
import { UserSettings, UserSettingsAttributes } from '../tables/UserSettings';
import { SuperBus } from '../modules/SuperBus';
import { Repos } from '.';
import { Modules } from 'openland-modules/Modules';

export interface Settings {
    emailFrequency: '1hour' | '15min' | 'never' | '24hour' | '1week';
    desktopNotifications: 'all' | 'direct' | 'none';
    mobileNotifications: 'all' | 'direct' | 'none';
    mobileAlert: boolean;
    mobileIncludeText: boolean;
    notificationsDelay: 'none' | '1min' | '15min';
}

class UserSettingsReader {
    private pending = new Map<number, (() => void)[]>();

    onMessage(userId: number) {
        if (this.pending.has(userId)) {
            let callbacks = this.pending.get(userId)!!;
            if (callbacks.length > 0) {
                let cb = [...callbacks];
                this.pending.set(userId, []);
                for (let c of cb) {
                    c();
                }
            }
        }
    }

    loadNext = async (userId: number) => {
        if (!this.pending.has(userId)) {
            this.pending.set(userId, []);
        }
        return await new Promise<number>((resolver) => this.pending.get(userId)!!.push(resolver));
    }
}

export class UserRepository {
    readonly settingsReader: UserSettingsReader;
    private readonly userCache = new Map<string, number | undefined>();
    private readonly settingsSuperbus: SuperBus<{ userId: number }, UserSettings, Partial<UserSettingsAttributes>>;

    constructor() {
        this.settingsReader = new UserSettingsReader();
        this.settingsSuperbus = new SuperBus('user_settings', DB.UserSettings, 'user_settings');
        this.settingsSuperbus.eventBuilder((src) => ({ userId: src.userId }));
        this.settingsSuperbus.eventHandler((event) => {
            this.settingsReader.onMessage(event.userId);
        });
        this.settingsSuperbus.start();
    }

    async createUser(uid: number, input: {
        firstName: string,
        lastName?: string | null,
        photoRef?: ImageRef | null,
        phone?: string | null,
        email?: string | null,
        website?: string | null,
        about?: string | null,
        location?: string | null
    }, tx: Transaction, isBot: boolean = false) {
        let user = await DB.User.findById(uid, { transaction: tx });
        if (!user) {
            throw Error('Unable to find user');
        }

        await Modules.Users.createUserProfile(user, input);

        if (!isBot && user.status === 'ACTIVATED') {
            await Repos.Chats.addToInitialChannel(user.id!!, tx);
        }

        return user;
    }

    userLoader(context: CallContext) {
        if (!context.cache.has('__user_loader')) {
            context.cache.set('__user_loader', new DataLoader<number, User | null>(async (ids) => {
                let foundTokens = await DB.User.findAll({
                    where: {
                        id: {
                            $in: ids
                        }
                    }
                });

                let res: (User | null)[] = [];
                for (let i of ids) {
                    let found = false;
                    for (let f of foundTokens) {
                        if (i === f.id) {
                            res.push(f);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        res.push(null);
                    }
                }
                return res;
            }));
        }
        let loader = context.cache.get('__user_loader') as DataLoader<number, User | null>;
        return loader;
    }

    async fetchOrganizationMembers(organizationId: number) {
        let uids = (await DB.OrganizationMember.findAll({
            where: {
                orgId: organizationId
            }
        })).map((v) => v.userId);
        return await DB.User.findAll({
            where: {
                id: { $in: uids }
            }
        });
    }

    async fetchUserByAuthId(authId: string): Promise<number | undefined> {
        if (this.userCache.has(authId)) {
            return this.userCache.get(authId);
        } else {
            let exists = await DB.User.find({
                where: {
                    authId: authId
                }
            });
            if (exists != null) {
                if (!this.userCache.has(authId)) {
                    this.userCache.set(authId, exists.id!!);
                }
                return exists.id;
            } else {
                if (!this.userCache.has(authId)) {
                    this.userCache.set(authId, undefined);
                }
                return undefined;
            }
        }
    }

    async fetchUserAccounts(uid: number, tx?: Transaction): Promise<number[]> {
        return (await DB.OrganizationMember.findAll({
            where: {
                userId: uid
            },
            transaction: tx
        })).map((v) => v.orgId);
    }

    async isMemberOfOrganization(uid: number, orgId: number): Promise<boolean> {
        let isMember = await DB.OrganizationMember.findOne({
            where: {
                userId: uid,
                orgId: orgId
            }
        });

        return !!isMember;
    }

    async isUserOnline(uid: number): Promise<boolean> {
        return await Modules.Presence.getLastSeen(uid) === 'online';
    }

    getUserSettingsFromInstance(instance: UserSettings) {
        let settings: Settings = {
            emailFrequency: '1hour',
            desktopNotifications: 'all',
            mobileNotifications: 'all',
            mobileAlert: true,
            mobileIncludeText: true,
            notificationsDelay: 'none'
        };
        if (instance) {
            if (instance.settings.emailFrequency) {
                settings.emailFrequency = instance.settings.emailFrequency as any;
            }
            if (instance.settings.desktopNotifications) {
                settings.desktopNotifications = instance.settings.desktopNotifications as any;
            }
            if (instance.settings.mobileNotifications) {
                settings.mobileNotifications = instance.settings.mobileNotifications as any;
            }
            if (instance.settings.mobileAlert !== undefined) {
                settings.mobileAlert = instance.settings.mobileAlert as any;
            }
            if (instance.settings.mobileIncludeText !== undefined) {
                settings.mobileIncludeText = instance.settings.mobileIncludeText as any;
            }
            if (instance.settings.notificationsDelay) {
                settings.notificationsDelay = instance.settings.notificationsDelay as any;
            }
        }
        return settings;
    }

    async getUserSettings(uid: number) {
        let res = await DB.UserSettings.find({ where: { userId: uid }, logging: false });
        let settings: Settings = {
            emailFrequency: '1hour',
            desktopNotifications: 'all',
            mobileNotifications: 'all',
            mobileAlert: true,
            mobileIncludeText: true,
            notificationsDelay: 'none'
        };
        if (res) {
            if (res.settings.emailFrequency) {
                settings.emailFrequency = res.settings.emailFrequency as any;
            }
            if (res.settings.desktopNotifications) {
                settings.desktopNotifications = res.settings.desktopNotifications as any;
            }
            if (res.settings.mobileNotifications) {
                settings.mobileNotifications = res.settings.mobileNotifications as any;
            }
            if (res.settings.mobileAlert !== undefined) {
                settings.mobileAlert = res.settings.mobileAlert as any;
            }
            if (res.settings.mobileIncludeText !== undefined) {
                settings.mobileIncludeText = res.settings.mobileIncludeText as any;
            }
            if (res.settings.notificationsDelay) {
                settings.notificationsDelay = res.settings.notificationsDelay as any;
            }
        }
        return settings;
    }

    async getUserInvitedBy(uid: number) {
        let user = await DB.User.findOne({ where: { id: uid } });
        if (user && user.invitedBy) {
            return await DB.User.findOne({ where: { id: user.invitedBy } });
        }
        return null;
    }

    async getUserLastIp(uid: number) {

        // let lastActiveToken = await DB.UserToken.findAll({
        //     where: {
        //         userId: uid
        //     },
        //     order: [['updatedAt', 'DESC']],
        //     limit: 1
        // });

        // if (!lastActiveToken[0]) {
        //     return null;
        // }

        // return lastActiveToken[0].lastIp || null;
        return null;
    }
}