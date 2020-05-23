import { FeatureRepository } from './repositories/FeatureRepository';
import { injectable } from 'inversify';

@injectable()
export class FeaturesModule {
    readonly repo = new FeatureRepository();
    
    start = async () => {
        // Nothing to do
    }
}