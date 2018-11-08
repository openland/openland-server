import { ImageRef } from 'openland-module-media/ImageRef';

export interface ProfileInput {
    firstName?: string | undefined | null;
    lastName?: string | undefined | null;
    photoRef?: ImageRef | undefined | null;
    phone?: string | undefined | null;
    email?: string | undefined | null;
    website?: string | undefined | null;
    about?: string | undefined | null;
    location?: string | undefined | null;
    linkedin?: string | undefined | null;
    twitter?: string | undefined | null;
    primaryOrganization?: string | undefined | null;
}