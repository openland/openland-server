
import { container } from 'openland-modules/Modules.container';
import { InvitesMediator } from './mediators/InvitesMediator';
import { InvitesOrganizationRepository } from './repositories/InvitesOrganizationRepository';
import { InvitesRoomRepository } from './repositories/InvitesRoomRepository';
import { InvitesModule } from './InvitesModule';

export function loadInvitesModule() {
    container.bind(InvitesModule).toSelf().inSingletonScope();
    container.bind('InvitesMediator').to(InvitesMediator).inSingletonScope();
    container.bind('InvitesOrganizationRepository').to(InvitesOrganizationRepository).inSingletonScope();
    container.bind('InvitesRoomRepository').to(InvitesRoomRepository).inSingletonScope();
}