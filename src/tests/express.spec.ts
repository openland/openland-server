import prepareApp from './utils/prepareApp';
import { initApi } from '../init/initApi';

beforeAll(async () => {
    await prepareApp();
    await initApi(true);
});

describe('API Server', () => {
    it('should authenticate correctly', () => {
        // TODO
    });
});