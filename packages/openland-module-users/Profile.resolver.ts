import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-server/api/utils/IDs';
import { UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { inTx } from 'foundation-orm/inTx';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { withUser } from 'openland-server/api/utils/Resolvers';
import { ImageRef } from 'openland-module-media/ImageRef';
import { AccessDeniedError } from 'openland-server/errors/AccessDeniedError';
import { ProfileInput } from './ProfileInput';

export default {
    Profile: {
        id: (src: UserProfile) => IDs.Profile.serialize(src.id!!),
        firstName: (src: UserProfile) => src.firstName,
        lastName: (src: UserProfile) => src.lastName,
        photoRef: (src: UserProfile) => src.picture,
        email: (src: UserProfile) => src.email,
        phone: (src: UserProfile) => src.phone,
        website: (src: UserProfile) => src.website,
        about: (src: UserProfile) => src.about,
        location: (src: UserProfile) => src.location,
        linkedin: (src: UserProfile) => src.linkedin,
        twitter: (src: UserProfile) => src.twitter,
        primaryOrganization: async (src: UserProfile) => await FDB.Organization.findById(src.primaryOrganization || (await Modules.Orgs.findUserOrganizations(src.id))[0]),

        alphaRole: (src: UserProfile) => src.role,
        alphaLocations: (src: UserProfile) => src.locations,
        alphaLinkedin: (src: UserProfile) => src.linkedin,
        alphaTwitter: (src: UserProfile) => src.twitter,
        alphaPrimaryOrganizationId: (src: UserProfile) => src.primaryOrganization ? IDs.Organization.serialize(src.primaryOrganization) : null,
        alphaPrimaryOrganization: async (src: UserProfile) => await FDB.Organization.findById(src.primaryOrganization || (await Modules.Orgs.findUserOrganizations(src.id))[0]),
        alphaJoinedAt: (src: UserProfile) => src.createdAt,
        alphaInvitedBy: async (src: UserProfile) => {
            let user = await FDB.User.findById(src.id);
            if (user && user.invitedBy) {
                return await FDB.User.findById(user.invitedBy);
            }
            return null;
        },
    },
    Query: {
        myProfile: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            }
            return Modules.Users.profileById(context.uid);
        },
    },
    Mutation: {
        profileCreate: withUser<{ input: ProfileInput }>(async (args, uid) => {
            return await Modules.Users.createUserProfile(uid, args.input);
        }),
        profileUpdate: withUser<{ input: ProfileInput, uid?: string }>(async (args, uid) => {
            return await inTx(async () => {
                if (args.uid) {
                    let role = await Modules.Super.superRole(uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await FDB.User.findById(uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                await inTx(async () => {
                    let profile = await Modules.Users.profileById(uid);
                    if (!profile) {
                        throw Error('Unable to find profile');
                    }
                    if (args.input.firstName !== undefined) {
                        await validate(
                            stringNotEmpty('First name can\'t be empty!'),
                            args.input.firstName,
                            'input.firstName'
                        );
                        profile.firstName = Sanitizer.sanitizeString(args.input.firstName)!;
                    }
                    if (args.input.lastName !== undefined) {
                        profile.lastName = Sanitizer.sanitizeString(args.input.lastName);
                    }
                    if (args.input.location !== undefined) {
                        profile.location = Sanitizer.sanitizeString(args.input.location);
                    }
                    if (args.input.website !== undefined) {
                        profile.website = Sanitizer.sanitizeString(args.input.website);
                    }
                    if (args.input.about !== undefined) {
                        profile.about = Sanitizer.sanitizeString(args.input.about);
                    }
                    if (args.input.photoRef !== undefined) {
                        if (args.input.photoRef !== null) {
                            await Modules.Media.saveFile(args.input.photoRef.uuid);
                        }
                        profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
                    }
                    if (args.input.phone !== undefined) {
                        profile.phone = Sanitizer.sanitizeString(args.input.phone);
                    }
                    if (args.input.email !== undefined) {
                        profile.email = Sanitizer.sanitizeString(args.input.email);
                    }

                    if (args.input.linkedin !== undefined) {
                        profile.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                    }

                    if (args.input.twitter !== undefined) {
                        profile.twitter = Sanitizer.sanitizeString(args.input.twitter);
                    }

                    if (args.input.primaryOrganization) {
                        profile.primaryOrganization = IDs.Organization.parse(args.input.primaryOrganization);
                    }
                });
                return user;
            });
        }),

        // Deprecated
        createProfile: withUser<{ input: ProfileInput }>(async (args, uid) => {
            return await Modules.Users.createUserProfile(uid, args.input);
        }),
        updateProfile: withUser<{
            input: {
                firstName?: string | null,
                lastName?: string | null,
                photoRef?: ImageRef | null,
                phone?: string | null,
                email?: string | null,
                website?: string | null,
                about?: string | null,
                location?: string | null,
                alphaLocations?: string[] | null,
                alphaLinkedin?: string | null,
                alphaTwitter?: string | null,
                alphaRole?: string | null,
                alphaPrimaryOrganizationId?: string,
            },
            uid?: string
        }>(async (args, uid) => {
            return await inTx(async () => {
                if (args.uid) {
                    let role = await Modules.Super.superRole(uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await FDB.User.findById(uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                await inTx(async () => {
                    let profile = await Modules.Users.profileById(uid);
                    if (!profile) {
                        throw Error('Unable to find profile');
                    }
                    if (args.input.firstName !== undefined) {
                        await validate(
                            stringNotEmpty('First name can\'t be empty!'),
                            args.input.firstName,
                            'input.firstName'
                        );
                        profile.firstName = Sanitizer.sanitizeString(args.input.firstName)!;
                    }
                    if (args.input.lastName !== undefined) {
                        profile.lastName = Sanitizer.sanitizeString(args.input.lastName);
                    }
                    if (args.input.location !== undefined) {
                        profile.location = Sanitizer.sanitizeString(args.input.location);
                    }
                    if (args.input.website !== undefined) {
                        profile.website = Sanitizer.sanitizeString(args.input.website);
                    }
                    if (args.input.about !== undefined) {
                        profile.about = Sanitizer.sanitizeString(args.input.about);
                    }
                    if (args.input.photoRef !== undefined) {
                        if (args.input.photoRef !== null) {
                            await Modules.Media.saveFile(args.input.photoRef.uuid);
                        }
                        profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
                    }
                    if (args.input.phone !== undefined) {
                        profile.phone = Sanitizer.sanitizeString(args.input.phone);
                    }
                    if (args.input.email !== undefined) {
                        profile.email = Sanitizer.sanitizeString(args.input.email);
                    }

                    if (args.input.alphaLocations !== undefined) {
                        profile.locations = Sanitizer.sanitizeAny(args.input.alphaLocations);
                    }

                    if (args.input.alphaLinkedin !== undefined) {
                        profile.linkedin = Sanitizer.sanitizeString(args.input.alphaLinkedin);
                    }

                    if (args.input.alphaTwitter !== undefined) {
                        profile.twitter = Sanitizer.sanitizeString(args.input.alphaTwitter);
                    }

                    if (args.input.alphaRole !== undefined) {
                        profile.role = Sanitizer.sanitizeString(args.input.alphaRole);
                    }

                    if (args.input.alphaPrimaryOrganizationId !== undefined) {
                        profile.primaryOrganization = IDs.Organization.parse(args.input.alphaPrimaryOrganizationId);
                    }
                });
                return user;
            });
        }),
    }
};