import { DB } from '../tables';
describe('Simple Database Test', () => {
    it('Should incert data correctly', async () => {
        console.log('hey');
        await DB.User.findAll();
    });
});