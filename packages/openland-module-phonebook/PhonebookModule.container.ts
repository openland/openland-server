import { container } from '../openland-modules/Modules.container';
import { PhonebookRepository } from './repositories/PhonebookRepository';

export function loadPhonebookModule() {
    container.bind(PhonebookRepository).toSelf().inSingletonScope();
}
