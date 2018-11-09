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
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { InvitesModule } from 'openland-module-invites/InvitesModule';
import { PubsubModule } from 'openland-module-pubsub/PubsubModule';
import { MediaModule } from 'openland-module-media/MediaModule';
import { ApiModule } from 'openland-module-api/ApiModule';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { ModulesRegistry } from './ModulesRegistry';
import { ModulesTypes } from './ModulesTypes';
import { createDefaultContainer } from './Modules.container';

class ModulesImpl implements ModulesRegistry {

    get Hooks() {
        return this.container.resolve(HooksModule);
    }
    get Media() {
        return this.container.resolve(MediaModule);
    }
    get Auth() {
        return this.container.resolve(AuthModule);
    }
    get DB() {
        return this.container.resolve(DBModule);
    }
    get Workers() {
        return this.container.resolve(WorkerModule);
    }
    get Push() {
        return this.container.resolve(PushModule);
    }
    get Presence() {
        return this.container.resolve(PresenceModule);
    }
    get Email() {
        return this.container.resolve(EmailModule);
    }
    get Messaging() {
        return this.container.resolve(MessagingModule);
    }
    get Users() {
        return this.container.resolve(UsersModule);
    }
    get Features() {
        return this.container.resolve(FeaturesModule);
    }
    get Search() {
        return this.container.resolve(SearchModule);
    }
    get Super() {
        return this.container.resolve(SuperModule);
    }
    get Shortnames() {
        return this.container.resolve(ShortnameModule);
    }
    get Hyperlog() {
        return this.container.resolve(HyperlogModule);
    }
    get Drafts() {
        return this.container.resolve(DraftsModule);
    }
    get Typings() {
        return this.container.resolve(TypingsModule);
    }
    get Orgs() {
        return this.container.resolve(OrganizationModule);
    }
    get Invites() {
        return this.container.resolve(InvitesModule);
    }
    get Pubsub() {
        return this.container.resolve(PubsubModule);
    }
    get API() {
        return this.container.resolve(ApiModule);
    }

    private readonly container = createDefaultContainer();

    constructor() {
        this.container.bind(ModulesTypes.Registry).toConstantValue(this);
    }

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