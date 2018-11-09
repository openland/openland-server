import { PushModule } from 'openland-module-push/PushModule';
import { WorkerModule } from 'openland-module-workers/WorkerModule';
import { DBModule } from 'openland-module-db/DBModule';
import { PresenceModule } from 'openland-module-presences/PresenceModule';
import { EmailModule } from 'openland-module-email/EmailModule';
import { MessagingModule } from 'openland-module-messaging/MessagingModule';
import { AuthModule } from 'openland-module-auth/AuthModule';
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
import { MediaModule } from 'openland-module-media/MediaModule';
import { ApiModule } from 'openland-module-api/ApiModule';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { ModulesRegistry } from './ModulesRegistry';

class ModulesImpl implements ModulesRegistry {
    readonly Hooks = new HooksModule();
    readonly Media = new MediaModule();
    readonly Auth = new AuthModule();
    readonly DB = new DBModule();
    readonly Workers = new WorkerModule();
    readonly Push = new PushModule();
    readonly Presence = new PresenceModule();
    readonly Email = new EmailModule();
    readonly Messaging = new MessagingModule();
    readonly Users = new UsersModule();
    readonly Features = new FeaturesModule();
    readonly Search = new SearchModule();
    readonly Super = new SuperModule();
    readonly Shortnames = new ShortnameModule();
    readonly Hyperlog = new HyperlogModule();
    readonly Drafts = new DraftsModule();
    readonly Typings = new TypingsModule();
    readonly Orgs: OrgsModule = new OrgsModule(this);
    readonly Invites = new InvitesModule();
    readonly Pubsub = new PubsubModule();
    readonly API = new ApiModule();

    start = async () => {
        await this.Hooks.start();
        await this.DB.start();
        await this.Media.start();
        await this.Workers.start();
        await this.Push.start();
        await this.Presence.start();
        await this.Email.start();
        await this.Users.start();
        await this.Messaging.start();
        await this.Features.start();
        await this.Search.start();
        await this.Super.start();
        await this.Shortnames.start();
        await this.Hyperlog.start();
        await this.Drafts.start();
        await this.Typings.start();
        await this.Orgs.start();
        await this.Invites.start();
        await this.Pubsub.start();
        await this.API.start();
    }
}

export const Modules = new ModulesImpl() as ModulesRegistry;