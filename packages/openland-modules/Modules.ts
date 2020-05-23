import { DiscussionsModule } from './../openland-module-discussions/DiscussionsModule';
import { WalletModule } from '../openland-module-wallet/WalletModule';
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
import { container } from './Modules.container';
import { CallsModule } from 'openland-module-calls/CallsModule';
import { SocialModule } from 'openland-module-social/SocialModule';
import { FeedModule } from 'openland-module-feed/FeedModule';
import { AppsModule } from '../openland-module-apps/AppsModule';
import { CommentsModule } from '../openland-module-comments/CommentsModule';
import { DiscoverModule } from '../openland-module-discover/DiscoverModule';
import { NotificationCenterModule } from '../openland-module-notification-center/NotificationCenterModule';
import { MetricsModule } from '../openland-module-metrics/MetricsModule';
import { UserOnboardingModule } from '../openland-module-user-onboarding/UserOnboardingModule';
import { StatsModule } from '../openland-module-stats/StatsModule';
import { MonitoringModule } from 'openland-module-monitoring/MonitoringModule';
import { StickersModule } from '../openland-module-stickers/StickersModule';
import { MatchmakingModule } from '../openland-module-matchmaking/MatchmakingModule';
import { ZapierModule } from '../openland-module-zapier/ZapierModule';
import { OauthModule } from '../openland-module-oauth/OauthModule';
import { GeoModule } from '../openland-module-geo/GeoModule';
import { PowerupsModule } from '../openland-module-powerups/PowerupsModule';
import { PermissionsModule } from '../openland-module-permissions/PermissionsModule';
import { PhonebookModule } from '../openland-module-phonebook/PhonebookModule';

class ModulesImpl {

    get Hooks() {
        return container.get<HooksModule>('HooksModule');
    }
    get Media() {
        return container.get(MediaModule);
    }
    get Auth() {
        return container.get(AuthModule);
    }
    get DB() {
        return container.get(DBModule);
    }
    get Workers() {
        return container.get(WorkerModule);
    }
    get Push() {
        return container.get(PushModule);
    }
    get Presence() {
        return container.get(PresenceModule);
    }
    get Email(): EmailModule {
        return container.get<EmailModule>('EmailModule');
    }
    get Messaging() {
        return container.get(MessagingModule);
    }
    get Users() {
        return container.get(UsersModule);
    }
    get Features() {
        return container.get(FeaturesModule);
    }
    get Search() {
        return container.get(SearchModule);
    }
    get Super() {
        return container.get(SuperModule);
    }
    get Shortnames() {
        return container.get(ShortnameModule);
    }
    get Hyperlog() {
        return container.get(HyperlogModule);
    }
    get Drafts() {
        return container.get(DraftsModule);
    }
    get Typings() {
        return container.get(TypingsModule);
    }
    get Orgs() {
        return container.get(OrganizationModule);
    }
    get Invites() {
        return container.get(InvitesModule);
    }
    get Pubsub() {
        return container.get(PubsubModule);
    }
    get API() {
        return container.get(ApiModule);
    }
    get Calls() {
        return container.get(CallsModule);
    }
    get Social() {
        return container.get(SocialModule);
    }
    get Feed() {
        return container.get(FeedModule);
    }
    get Bots() {
        return container.get(AppsModule);
    }
    get Comments() {
        return container.get(CommentsModule);
    }
    get Discover() {
        return container.get(DiscoverModule);
    }
    get NotificationCenter() {
        return container.get(NotificationCenterModule);
    }
    get Metrics() {
        return container.get(MetricsModule);
    }
    get UserOnboarding() {
        return container.get(UserOnboardingModule);
    }
    get Stats() {
        return container.get(StatsModule);
    }
    get Monitoring() {
        return container.get<MonitoringModule>('MonitoringModule');
    }
    get Stickers() {
        return container.get(StickersModule);
    }
    get Matchmaking() {
        return container.get(MatchmakingModule);
    }
    get Zapier() {
        return container.get(ZapierModule);
    }
    get Oauth() {
        return container.get(OauthModule);
    }
    get Geo() {
        return container.get(GeoModule);
    }
    get Powerups() {
        return container.get(PowerupsModule);
    }
    get Wallet() {
        return container.get(WalletModule);
    }
    get Permissions() {
        return container.get(PermissionsModule);
    }
    get Phonebook() {
        return container.get(PhonebookModule);
    }
    get Discussions() {
        return container.get(DiscussionsModule);
    }
}

export const Modules = new ModulesImpl();
