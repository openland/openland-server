import { FeatureRepository } from './repositories/FeatureRepository';
import { FDB } from 'openland-module-db/FDB';
import { injectable } from 'inversify';

@injectable()
export class FeaturesModule {
    readonly repo = new FeatureRepository(FDB);
    
    start = () => {
        // Nothing to do
    }
}