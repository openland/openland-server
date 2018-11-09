import { HooksModule } from 'openland-module-hooks/HooksModule';
import { MediaModule } from 'openland-module-media/MediaModule';
import { AuthModule } from 'openland-module-auth/AuthModule';
import { DBModule } from 'openland-module-db/DBModule';
import { WorkerModule } from 'openland-module-workers/WorkerModule';
import { PushModule } from 'openland-module-push/PushModule';
import { PresenceModule } from 'openland-module-presences/PresenceModule';
import { EmailModule } from 'openland-module-email/EmailModule';
import { MessagingModule } from 'openland-module-messaging/MessagingModule';
import { UsersModule } from 'openland-module-users/UsersModule';
import { FeaturesModule } from 'openland-module-features/FeaturesModule';
import { SearchModule } from 'openland-module-search/SearchModule';
import { SuperModule } from 'openland-module-super/SuperModule';
import { ShortnameModule } from 'openland-module-shortname/ShortnameModule';
import { HyperlogModule } from 'openland-module-hyperlog/HyperlogModule';
import { DraftsModule } from 'openland-module-drafts/DraftsModule';
import { TypingsModule } from 'openland-module-typings/TypingsModule';
import { OrgsModule } from 'openland-module-orgs/OrgsModule';
import { InvitesModule } from 'openland-module-invites/InvitesModule';
import { PubsubModule } from 'openland-module-pubsub/PubsubModule';
import { ApiModule } from 'openland-module-api/ApiModule';

export interface ModulesRegistry {
    readonly Hooks: HooksModule;
    readonly Media: MediaModule;
    readonly Auth: AuthModule;
    readonly DB: DBModule;
    readonly Workers: WorkerModule;
    readonly Push: PushModule;
    readonly Presence: PresenceModule;
    readonly Email: EmailModule;
    readonly Messaging: MessagingModule;
    readonly Users: UsersModule;
    readonly Features: FeaturesModule;
    readonly Search: SearchModule;
    readonly Super: SuperModule;
    readonly Shortnames: ShortnameModule;
    readonly Hyperlog: HyperlogModule;
    readonly Drafts: DraftsModule;
    readonly Typings: TypingsModule;
    readonly Orgs: OrgsModule;
    readonly Invites: InvitesModule;
    readonly Pubsub: PubsubModule;
    readonly API: ApiModule;

    start: () => Promise<void>;
}