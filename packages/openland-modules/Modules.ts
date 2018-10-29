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

class ModulesImpl {
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

    start = () => {
        this.DB.start();
        this.Workers.start();
        this.Push.start();
        this.Presence.start();
        this.Email.start();
        this.Users.start();
        this.Messaging.start();
        this.Features.start();
        this.Search.start();
        this.Super.start();
        this.Shortnames.start();
        this.Hyperlog.start();
        this.Drafts.start();
    }
}

export const Modules = new ModulesImpl();