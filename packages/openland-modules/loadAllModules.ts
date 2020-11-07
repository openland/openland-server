import { ShardingModule } from './../openland-module-sharding/ShardingModule';
import 'reflect-metadata';
import { DiscussionsModule } from './../openland-module-discussions/DiscussionsModule';
import { Config } from 'openland-config/Config';
import { WalletModule } from '../openland-module-wallet/WalletModule';
import { MonitoringModule } from './../openland-module-monitoring/MonitoringModule';
import { Store } from './../openland-module-db/store';
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
import { backoff, currentTime } from 'openland-utils/timer';
import { createLogger } from '@openland/log';
import { EntityStorage } from '@openland/foundationdb-entity';
import { openStore } from 'openland-module-db/store';
import { UserOnboardingModule } from '../openland-module-user-onboarding/UserOnboardingModule';
import { StatsModule } from '../openland-module-stats/StatsModule';
import { loadMonitoringModule } from 'openland-module-monitoring/loadMonitoringModule';
import { loadStickersModule } from '../openland-module-stickers/Stickers.container';
import { loadMatchmakingModule } from '../openland-module-matchmaking/Matchmaking.container';
import { MatchmakingModule } from '../openland-module-matchmaking/MatchmakingModule';
import { MentionNotificationsMediator } from '../openland-module-messaging/mediators/MentionNotificationsMediator';
import { FeedMentionNotificationsMediator } from '../openland-module-feed/repositories/FeedMentionNotificationsMediator';
import { ZapierModule } from '../openland-module-zapier/ZapierModule';
import { OauthModule } from '../openland-module-oauth/OauthModule';
import { loadGeoModule } from '../openland-module-geo/GeoModule.container';
import { GeoModule } from '../openland-module-geo/GeoModule';
import { loadDiscoverModule } from '../openland-module-discover/DiscoverModule.container';
import { PhonebookModule } from '../openland-module-phonebook/PhonebookModule';
import { loadPhonebookModule } from '../openland-module-phonebook/PhonebookModule.container';
import { connect, Payload } from 'ts-nats';
import { loadDiscussionsModule } from 'openland-module-discussions/Discussions.container';
import { ClickHouseModule } from '../openland-module-clickhouse/ClickHouseModule';
import { createClient } from '../openland-module-clickhouse/createClient';
import { Shutdown } from 'openland-utils/Shutdown';
import { loadPresenceModule } from '../openland-module-presences/PresenceModule.container';
import { loadContactsModule } from '../openland-module-contacts/ContactsModule.container';
import { ContactsModule } from '../openland-module-contacts/ContactsModule';
import { asyncRun } from '../openland-spacex/utils/asyncRun';
import { EventsModule } from 'openland-module-events/EventsModule';
import { SocialImageModule } from '../openland-module-social-image/SocialImageModule';
import { loadSocialImageModule } from '../openland-module-social-image/SocialImageModule.container';

const logger = createLogger('starting');

export async function loadAllModules(ctx: Context, loadDb: boolean = true) {

    if (loadDb) {
        // Load NATS
        logger.log(ctx, 'Connecting to NATS: ' + JSON.stringify(Config.nats ? Config.nats.endpoints : null));
        let client = await connect({
            payload: Payload.JSON,
            servers: Config.nats ? Config.nats.endpoints : undefined,
            pingInterval: 15000,
            timeout: 10000,
            reconnectTimeWait: 1000,
            maxReconnectAttempts: -1,
            yieldTime: 100
        });
        container.bind('NATS').toConstantValue(client);
        // NATS shutdown
        Shutdown.registerWork({
            name: 'nats',
            shutdown: async () => {
                await client.drain();
                client.close();
            }
        });
        logger.log(ctx, 'NATS connected');

        // Load Database
        let start = currentTime();
        let db = await openDatabase();
        logger.log(ctx, 'Database opened in ' + (currentTime() - start) + ' ms');

        // Load Entity Store
        let storage = new EntityStorage(db);
        let store = await openStore(storage);
        container.bind<Store>('Store')
            .toConstantValue(store);

        // Load clickhouse
        asyncRun(async () => {
            await backoff(ctx, async () => {
                let chClient = await createClient(ctx);
                container.bind('ClickHouse').toConstantValue(chClient);
                logger.log(ctx, 'ClickHouse connected');
            });
        });
    }

    logger.log(ctx, 'Loading modules...');
    loadMonitoringModule();
    loadMessagingModule();
    loadAuthModule();
    loadUsersModule();
    loadSocialModule();
    loadShortnameModule();
    loadBotsModule();
    loadCommentsModule();
    loadNotificationCenterModule();
    loadOrganizationModule();
    loadPresenceModule();

    container.bind(PubsubModule).toSelf().inSingletonScope();
    container.bind(ApiModule).toSelf().inSingletonScope();
    container.bind(DBModule).toSelf().inSingletonScope();
    container.bind('HooksModule').to(HooksModule).inSingletonScope();
    container.bind(MediaModule).toSelf().inSingletonScope();
    container.bind(AuthModule).toSelf().inSingletonScope();
    container.bind(WorkerModule).toSelf().inSingletonScope();
    container.bind(ShardingModule).toSelf().inSingletonScope();
    container.bind(PushModule).toSelf().inSingletonScope();
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

    container.bind(OrganizationModule).toSelf().inSingletonScope();
    container.bind(OrganizationRepository).toSelf();
    loadInvitesModule();
    container.bind(UserOnboardingModule).toSelf().inSingletonScope();
    container.bind(StatsModule).toSelf().inSingletonScope();
    container.bind(ZapierModule).toSelf().inSingletonScope();
    container.bind(OauthModule).toSelf().inSingletonScope();
    container.bind(WalletModule).toSelf().inSingletonScope();

    loadCallsModule();
    loadFeedModule();
    loadStickersModule();
    loadMatchmakingModule();
    loadGeoModule();
    loadDiscoverModule();
    loadPhonebookModule();
    loadDiscussionsModule();
    container.bind(PhonebookModule).toSelf().inSingletonScope();
    container.bind(ClickHouseModule).toSelf().inSingletonScope();
    loadContactsModule();
    container.bind(ContactsModule).toSelf().inSingletonScope();
    container.bind(EventsModule).toSelf().inSingletonScope();
    loadSocialImageModule();

    logger.log(ctx, 'Modules loaded');
}

export async function startAllModules(ctx: Context) {
    logger.log(ctx, 'Starting module: Hooks');
    await container.get<HooksModule>('HooksModule').start();
    logger.log(ctx, 'Starting module: DB');
    await container.get(DBModule).start();
    logger.log(ctx, 'Starting module: Media');
    await container.get(MediaModule).start();
    logger.log(ctx, 'Starting module: Worker');
    await container.get(WorkerModule).start();
    logger.log(ctx, 'Starting module: Sharding');
    await container.get(ShardingModule).start();
    logger.log(ctx, 'Starting module: Push');
    await container.get(PushModule).start();
    logger.log(ctx, 'Starting module: Presence');
    await container.get(PresenceModule).start();
    logger.log(ctx, 'Starting module: Email');
    await container.get<EmailModule>('EmailModule').start();
    logger.log(ctx, 'Starting module: Users');
    await container.get(UsersModule).start();
    logger.log(ctx, 'Starting module: Messaging');
    await container.get(MessagingModule).start();
    logger.log(ctx, 'Starting module: Features');
    await container.get(FeaturesModule).start();
    logger.log(ctx, 'Starting module: Search');
    await container.get(SearchModule).start();
    logger.log(ctx, 'Starting module: Super');
    await container.get(SuperModule).start();
    logger.log(ctx, 'Starting module: Social');
    await container.get(SocialModule).start();
    logger.log(ctx, 'Starting module: Shortnames');
    await container.get(ShortnameModule).start();
    logger.log(ctx, 'Starting module: Hyperlog');
    await container.get(HyperlogModule).start();
    logger.log(ctx, 'Starting module: Drafts');
    await container.get(DraftsModule).start();
    logger.log(ctx, 'Starting module: Typings');
    await container.get(TypingsModule).start();
    logger.log(ctx, 'Starting module: Organization');
    await container.get(OrganizationModule).start();
    logger.log(ctx, 'Starting module: Invites');
    await container.get(InvitesModule).start();
    logger.log(ctx, 'Starting module: PubSub');
    await container.get(PubsubModule).start();
    logger.log(ctx, 'Starting module: Calls');
    await container.get(CallsModule).start();
    logger.log(ctx, 'Starting module: Feed');
    await container.get(FeedModule).start();
    logger.log(ctx, 'Starting module: Apps');
    await container.get(AppsModule).start();
    logger.log(ctx, 'Starting module: Comments');
    await container.get(CommentsModule).start();
    logger.log(ctx, 'Starting module: Discover');
    await container.get(DiscoverModule).start();
    logger.log(ctx, 'Starting module: Notification Center');
    await container.get(NotificationCenterModule).start();
    logger.log(ctx, 'Starting module: OnBoarding');
    await container.get(UserOnboardingModule).start();
    logger.log(ctx, 'Starting module: Stats');
    await container.get(StatsModule).start();
    logger.log(ctx, 'Starting module: Monitoring');
    await container.get<MonitoringModule>('MonitoringModule').start();
    logger.log(ctx, 'Starting module: Matchmaking');
    await container.get(MatchmakingModule).start();
    logger.log(ctx, 'Starting module: Zapier');
    await container.get(ZapierModule).start();
    logger.log(ctx, 'Starting module: Mediators???');
    await container.get<MentionNotificationsMediator>('MentionNotificationsMediator').start();
    await container.get<FeedMentionNotificationsMediator>('FeedMentionNotificationsMediator').start();
    logger.log(ctx, 'Starting module: OAuth');
    await container.get(OauthModule).start();
    logger.log(ctx, 'Starting module: Geo');
    await container.get(GeoModule).start();
    logger.log(ctx, 'Starting module: Wallet');
    await container.get(WalletModule).start();
    logger.log(ctx, 'Starting module: Phonebook');
    await container.get(PhonebookModule).start();
    logger.log(ctx, 'Starting module: Discussions');
    await container.get(DiscussionsModule).start();
    logger.log(ctx, 'Starting module: ClickHouse');
    await container.get(ClickHouseModule).start();
    logger.log(ctx, 'Starting module: Contacts');
    await container.get(ContactsModule).start();
    logger.log(ctx, 'Starting module: Events');
    await container.get(EventsModule).start();
    logger.log(ctx, 'Starting module: SocialImageModule');
    await container.get(SocialImageModule).start();

    // Enable API after all modules started
    logger.log(ctx, 'Starting module: API');
    await container.get(ApiModule).start();
}
