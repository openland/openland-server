
import { container } from 'openland-modules/Modules.container';
import { InvitesMediator } from './mediators/InvitesMediator';
import { InvitesOrganizationRepository } from './repositories/InvitesOrganizationRepository';
import { InvitesChannelsRepository } from './repositories/InvitesChannelsRepository';
import { InvitesModule } from './InvitesModule';

export function loadInvitesModule() {
    container.bind(InvitesModule).toSelf().inSingletonScope();
    container.bind('InvitesMediator').to(InvitesMediator).inSingletonScope();
    container.bind('InvitesOrganizationRepository').to(InvitesOrganizationRepository).inSingletonScope();
    container.bind('InvitesChannelsRepository').to(InvitesChannelsRepository).inSingletonScope();
}