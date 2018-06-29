import { DB } from '../tables';
import prepareApp from './utils/prepareApp';

beforeAll(prepareApp);

describe('Simple fatabase test', () => {
    it('Should query ', async () => {
        expect((await DB.User.findAll()).length).toBe(0);
    });
});