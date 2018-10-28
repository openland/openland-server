import { declareHyperlogIndexer } from './workers/declareHyperlogIndexer';

export class HyperlogModule {
    start = () => {
        declareHyperlogIndexer();
    }
}