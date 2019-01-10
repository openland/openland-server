import { container } from 'openland-modules/Modules.container';
import { OrganizationRepository } from './repositories/OrganizationRepository';

export function loadOrganizationModule() {
    container.bind('OrganizationRepository').to(OrganizationRepository);
}