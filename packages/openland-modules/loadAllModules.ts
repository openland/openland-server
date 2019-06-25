import { Store } from './../openland-module-db/store';
import { EntityLayer } from 'foundation-orm/EntityLayer';
import 'reflect-metadata';
import { container } from './Modules.container';
import { HooksModule } from 'openland-module-hooks/HooksModule';
import { DBModule } from 'openland-module-db/DBModule';
import { MediaModule } from 'openland-module-media/MediaModule';
import { WorkerModule } from 'openland-module-workers/WorkerModule';
import { PushModule } from 'openland-module-push/PushModule';
import { PresenceModule } from 'openland-module-presences/PresenceModule';
import { EmailModuleImpl } from 'openland-module-email/EmailModule.impl';
import { EmailModule } from 'openland-module-email/EmailModule';
import { UsersModule } from 'openland-module-users/UsersModule';
import { MessagingModule } from 'openland-module-messaging/MessagingModule';
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
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { AuthModule } from 'openland-module-auth/AuthModule';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { loadMessagingModule } from 'openland-module-messaging/Messaging.container';
import { loadInvitesModule } from 'openland-module-invites/Invites.container';
import { CallsModule } from 'openland-module-calls/CallsModule';
import { loadCallsModule } from 'openland-module-calls/Calls.container';
import { loadAuthModule } from 'openland-module-auth/AuthModule.container';
import { loadUsersModule } from 'openland-module-users/UsersModule.container';
import { SocialModule } from 'openland-module-social/SocialModule';
import { loadSocialModule } from 'openland-module-social/SocialModule.container';
import { loadFeedModule } from 'openland-module-feed/FeedModule.container';
import { FeedModule } from 'openland-module-feed/FeedModule';
import { loadShortnameModule } from '../openland-module-shortname/ShortnameModule.container';
import { loadBotsModule } from '../openland-module-apps/AppsModule.container';
import { AppsModule } from '../openland-module-apps/AppsModule';
import { loadOrganizationModule } from '../openland-module-organization/OrganizationModule.container';
import { CommentsModule } from '../openland-module-comments/CommentsModule';
import { loadCommentsModule } from '../openland-module-comments/CommentsModule.container';
import { DiscoverModule } from '../openland-module-discover/DiscoverModule';
import { Context } from '@openland/context';
import { NotificationCenterModule } from '../openland-module-notification-center/NotificationCenterModule';
import { loadNotificationCenterModule } from '../openland-module-notification-center/NotificationCenterModule.container';
import { openDatabase } from 'openland-server/foundationdb';
import { MetricsModule } from '../openland-module-metrics/MetricsModule';
import { currentTime } from 'openland-utils/timer';
import { createLogger } from '@openland/log';
import { EntityStorage } from '@openland/foundationdb-entity';
import { openStore } from 'openland-module-db/store';
import { UserOnboardingModule } from '../openland-module-user-onboarding/UserOnboardingModule';

const logger = createLogger('starting');

export async function loadAllModules(ctx: Context, loadDb: boolean = true) {

    if (loadDb) {
        let start = currentTime();
        let db = await openDatabase();
        logger.log(ctx, 'Datbase opened in ' + (currentTime() - start) + ' ms');

        // Old Entity
        start = currentTime();
        let layer = new EntityLayer(db, 'app');
        let entities = await AllEntitiesDirect.create(layer);
        logger.log(ctx, 'Layer started in ' + (currentTime() - start) + ' ms');
        container.bind<AllEntities>('FDB')
            .toDynamicValue(() => entities)
            .inSingletonScope();

        // New entity
        let storage = new EntityStorage(db);
        let store = await openStore(storage);
        container.bind<Store>('Store')
            .toDynamicValue(() => store)
            .inSingletonScope();
    }

    loadMessagingModule();
    loadAuthModule();
    loadUsersModule();
    loadSocialModule();
    loadShortnameModule();
    loadBotsModule();
    loadCommentsModule();
    loadNotificationCenterModule();
    loadOrganizationModule();

    container.bind(DBModule).toSelf().inSingletonScope();
    container.bind('HooksModule').to(HooksModule).inSingletonScope();
    container.bind(MediaModule).toSelf().inSingletonScope();
    container.bind(AuthModule).toSelf().inSingletonScope();
    container.bind(WorkerModule).toSelf().inSingletonScope();
    container.bind(PushModule).toSelf().inSingletonScope();
    container.bind(PresenceModule).toSelf().inSingletonScope();
    container.bind('EmailModule').to(EmailModuleImpl).inSingletonScope();
    container.bind(UsersModule).toSelf().inSingletonScope();
    container.bind(FeaturesModule).toSelf().inSingletonScope();
    container.bind(SearchModule).toSelf().inSingletonScope();
    container.bind(SuperModule).toSelf().inSingletonScope();
    container.bind(ShortnameModule).toSelf().inSingletonScope();
    container.bind(HyperlogModule).toSelf().inSingletonScope();
    container.bind(DraftsModule).toSelf().inSingletonScope();
    container.bind(TypingsModule).toSelf().inSingletonScope();
    container.bind(AppsModule).toSelf().inSingletonScope();
    container.bind(MetricsModule).toSelf().inSingletonScope();

    container.bind(OrganizationModule).toSelf().inSingletonScope();
    container.bind(OrganizationRepository).toSelf();
    loadInvitesModule();
    container.bind(PubsubModule).toSelf().inSingletonScope();
    container.bind(ApiModule).toSelf().inSingletonScope();
    container.bind(DiscoverModule).toSelf().inSingletonScope();
    container.bind(UserOnboardingModule).toSelf().inSingletonScope();

    loadCallsModule();
    loadFeedModule();
}

export async function startAllModules() {
    await container.get<HooksModule>('HooksModule').start();
    await container.get(DBModule).start();
    await container.get(MediaModule).start();
    await container.get(WorkerModule).start();
    await container.get(PushModule).start();
    await container.get(PresenceModule).start();
    await container.get<EmailModule>('EmailModule').start();
    await container.get(UsersModule).start();
    await container.get(MessagingModule).start();
    await container.get(FeaturesModule).start();
    await container.get(SearchModule).start();
    await container.get(SuperModule).start();
    await container.get(SocialModule).start();
    await container.get(ShortnameModule).start();
    await container.get(HyperlogModule).start();
    await container.get(DraftsModule).start();
    await container.get(TypingsModule).start();
    await container.get(OrganizationModule).start();
    await container.get(InvitesModule).start();
    await container.get(PubsubModule).start();
    await container.get(ApiModule).start();
    await container.get(CallsModule).start();
    await container.get(FeedModule).start();
    await container.get(AppsModule).start();
    await container.get(CommentsModule).start();
    await container.get(DiscoverModule).start();
    await container.get(NotificationCenterModule).start();
    await container.get(MetricsModule).start();
    await container.get(UserOnboardingModule).start();
}