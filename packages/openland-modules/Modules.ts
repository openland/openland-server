import { PushModule } from 'openland-module-push/PushModule';
import { WorkerModule } from 'openland-module-workers/WorkerModule';
import { DBModule } from 'openland-module-db/DBModule';
import { PresenceModule } from 'openland-module-presences/PresenceModule';
import { EmailModule } from 'openland-module-email/EmailModule';
import { MessagingModule } from 'openland-module-messaging/MessagingModule';
import { AuthModule } from 'openland-module-auth/AuthModule';
import { UsersModule } from 'openland-module-users/UsersModule';

class ModulesImpl {
    readonly Auth = new AuthModule();
    readonly DB = new DBModule();
    readonly Workers = new WorkerModule();
    readonly Push = new PushModule();
    readonly Presence = new PresenceModule();
    readonly Email = new EmailModule();
    readonly Messaging = new MessagingModule();
    readonly Users = new UsersModule();

    start = () => {
        this.DB.start();
        this.Workers.start();
        this.Push.start();
        this.Presence.start();
        this.Email.start();
        this.Users.start();
        this.Messaging.start();
    }
}

export const Modules = new ModulesImpl();