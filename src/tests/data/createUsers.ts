import { DB } from '../../tables';

export async function createUsers() {

    let user = await DB.User.create({
        authId: 'mock|steve',
        email: 'steve@openland.com'
    });
    await DB.UserProfile.create({
        userId: user.id,
        firstName: 'Steve',
        lastName: 'Kite'
    });

    let user2 = await DB.User.create({
        authId: 'mock|yury',
        email: 'yury@openland.com'
    });
    await DB.UserProfile.create({
        userId: user2.id,
        firstName: 'Yury',
        lastName: 'Lifshits'
    });

    await DB.User.create({
        authId: 'mock|gleb',
        email: 'gleb@openland.com'
    });
}