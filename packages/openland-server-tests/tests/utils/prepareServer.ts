import { loadAllModules } from 'openland-modules/loadAllModules';
import { Modules } from 'openland-modules/Modules';

export async function prepareServer() {
    await loadAllModules();

    return Modules.API;
}