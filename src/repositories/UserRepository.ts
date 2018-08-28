import { DB, User } from '../tables';
import DataLoader from 'dataloader';
import { CallContext } from '../api/utils/CallContext';
import { ImageRef } from './Media';
import { Transaction } from 'sequelize';
import { UserSettings, UserSettingsAttributes } from '../tables/UserSettings';
import { SuperBus } from '../modules/SuperBus';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { Sanitizer } from '../modules/Sanitizer';
import { Organization } from '../tables/Organization';

export interface Settings {
    emailFrequency: '1hour' | '15min' | 'never';
    desktopNotifications: 'all' | 'direct' | 'none';
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
    }, tx: Transaction) {
        let user = await DB.User.findById(uid, { transaction: tx });
        if (!user) {
            throw Error('Unable to find user');
        }

        // Do not create profile if already exists
        let existing = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
        if (existing) {
            return existing;
        }

        await validate(
            stringNotEmpty('First name can\'t be empty!'),
            input.firstName,
            'input.firstName'
        );

        // Create pfofile
        await DB.UserProfile.create({
            userId: uid,
            firstName: Sanitizer.sanitizeString(input.firstName)!,
            lastName: Sanitizer.sanitizeString(input.lastName),
            picture: Sanitizer.sanitizeImageRef(input.photoRef),
            phone: Sanitizer.sanitizeString(input.phone),
            email: Sanitizer.sanitizeString(input.email) || user.email,
            website: Sanitizer.sanitizeString(input.website),
            about: Sanitizer.sanitizeString(input.about),
            location: Sanitizer.sanitizeString(input.location)
        }, { transaction: tx });

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

    async fetchUserAccounts(uid: number): Promise<number[]> {
        return (await DB.OrganizationMember.findAll({
            where: {
                userId: uid
            }
        })).map((v) => v.orgId);
    }

    async saveProfile(uid: number, firstName: string, lastName: string | null, photo?: ImageRef | null, phone?: string | null) {
        return await DB.tx(async (tx) => {
            let existing = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
            if (!existing) {
                return await DB.UserProfile.create({
                    userId: uid,
                    firstName: firstName,
                    lastName: lastName,
                    picture: photo,
                    phone: phone
                }, { transaction: tx });
            } else {
                existing.firstName = firstName;
                existing.lastName = lastName;
                if (photo !== undefined) {
                    existing.picture = photo;
                }
                if (phone !== undefined) {
                    existing.phone = phone;
                }
                await existing.save({ transaction: tx });
                return existing;
            }
        });
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

    async markUserOnline(uid: number, timeout: number, tokenId: number) {
        let now = new Date();
        let expires = new Date(now.getTime() + timeout);
        await DB.txStableSilent(async (tx) => {
            let existing = await DB.UserPresence.find({
                where: { userId: uid, tokenId: tokenId },
                transaction: tx,
                lock: tx.LOCK.UPDATE,
                logging: false
            });
            if (existing) {
                existing.lastSeen = now;
                existing.lastSeenTimeout = expires;
                await existing.save({ transaction: tx, logging: false });
            } else {
                await DB.UserPresence.create({
                    userId: uid,
                    tokenId: tokenId,
                    lastSeen: now,
                    lastSeenTimeout: expires
                }, { transaction: tx, logging: false });
            }
            let user = await DB.User.findById(uid, { transaction: tx, lock: tx.LOCK.UPDATE, logging: false });
            if (user) {
                if (user.lastSeen === null || user.lastSeen!!.getTime() < expires.getTime()) {
                    user.lastSeen = expires;
                    await user.save({ transaction: tx, logging: false });
                }
            }
        });
    }

    async getUserLastSeen(uid: number, tx: Transaction) {
        let user = await DB.User.findById(uid, { logging: false });
        let now = Date.now();
        if (!user) {
            return null;
        } else {
            if (user.lastSeen) {
                if (user.lastSeen.getTime() > now) {
                    return null;
                } else {
                    return user.lastSeen.getTime();
                }
            } else {
                return null;
            }
        }
    }

    getUserSettingsFromInstance(instance: UserSettings) {
        let settings: Settings = {
            emailFrequency: '1hour',
            desktopNotifications: 'all'
        };
        if (instance) {
            if (instance.settings.emailFrequency) {
                settings.emailFrequency = instance.settings.emailFrequency as any;
            }
            if (instance.settings.desktopNotifications) {
                settings.desktopNotifications = instance.settings.desktopNotifications as any;
            }
        }
        return settings;
    }

    async getUserSettings(uid: number) {
        let res = await DB.UserSettings.find({ where: { userId: uid } });
        let settings: Settings = {
            emailFrequency: '1hour',
            desktopNotifications: 'all'
        };
        if (res) {
            if (res.settings.emailFrequency) {
                settings.emailFrequency = res.settings.emailFrequency as any;
            }
            if (res.settings.desktopNotifications) {
                settings.desktopNotifications = res.settings.desktopNotifications as any;
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
}