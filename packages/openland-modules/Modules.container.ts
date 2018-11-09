import { Container } from 'inversify';
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
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { InvitesModule } from 'openland-module-invites/InvitesModule';
import { PubsubModule } from 'openland-module-pubsub/PubsubModule';
import { ApiModule } from 'openland-module-api/ApiModule';

export function createDefaultContainer() {
    let container = new Container();
    container.bind(HooksModule).toSelf().inSingletonScope();
    container.bind(MediaModule).toSelf().inSingletonScope();
    container.bind(AuthModule).toSelf().inSingletonScope();
    container.bind(DBModule).toSelf().inSingletonScope();
    container.bind(WorkerModule).toSelf().inSingletonScope();
    container.bind(PushModule).toSelf().inSingletonScope();
    container.bind(PresenceModule).toSelf().inSingletonScope();
    container.bind(EmailModule).toSelf().inSingletonScope();
    container.bind(MessagingModule).toSelf().inSingletonScope();
    container.bind(UsersModule).toSelf().inSingletonScope();
    container.bind(FeaturesModule).toSelf().inSingletonScope();
    container.bind(SearchModule).toSelf().inSingletonScope();
    container.bind(SuperModule).toSelf().inSingletonScope();
    container.bind(ShortnameModule).toSelf().inSingletonScope();
    container.bind(HyperlogModule).toSelf().inSingletonScope();
    container.bind(DraftsModule).toSelf().inSingletonScope();
    container.bind(TypingsModule).toSelf().inSingletonScope();
    container.bind(OrganizationModule).toSelf().inSingletonScope();
    container.bind(InvitesModule).toSelf().inSingletonScope();
    container.bind(PubsubModule).toSelf().inSingletonScope();
    container.bind(ApiModule).toSelf().inSingletonScope();
    return container;
}