import { loadAllModules } from 'openland-modules/loadAllModules';
import { Modules } from 'openland-modules/Modules';

export async function prepareServer() {
    loadAllModules();

    return Modules.API;
}