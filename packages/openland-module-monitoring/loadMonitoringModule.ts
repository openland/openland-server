import { container } from 'openland-modules/Modules.container';
import { MonitoringModule } from './MonitoringModule';

export function loadMonitoringModule() {
    container.bind('MonitoringModule').to(MonitoringModule).inSingletonScope();
}