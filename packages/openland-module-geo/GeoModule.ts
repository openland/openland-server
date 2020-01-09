import { GeoLocation, GeoRepository } from './GeoRepository';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { Modules } from '../openland-modules/Modules';

@injectable()
export class GeoModule {
    @inject('GeoRepository')
    private readonly repo!: GeoRepository;

    public start = () => {
        //
    }

    public reportGeo(parent: Context, uid: number, location: GeoLocation) {
        return this.repo.reportGeo(parent, uid, location);
    }

    public getUserGeo(parent: Context, uid: number) {
        return this.repo.getUserGeo(parent, uid);
    }

    public stopSharingGeo(parent: Context, uid: number) {
        return this.repo.stopSharingGeo(parent, uid);
    }

    public async shouldShareLocation(ctx: Context, uid: number) {
        let pid = await this.getGeoPowerupId(ctx);
        if (!pid) {
            return false;
        }

        let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
        let chatPowerups = await Modules.Powerups.findChatsWithPowerup(ctx, uid, pid);
        if (dialogs.some(a => chatPowerups.find(b => b.cid === a.cid &&
            Modules.Powerups.extractSettingsFromChatPowerup(b, uid).enabled))) {
            return true;
        }
        return false;
    }

    public async getGeoPowerupId(ctx: Context) {
        return await Modules.Super.getEnvVar<number>(ctx, 'geo-powerup-id');
    }
}