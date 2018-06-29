import { DB } from '../../tables';

export async function createUsers() {
    let user = await DB.User.create({
        authId: 'mock|steve',
        email: 'steve@openland.com'
    });
    console.warn(user.id);
    await DB.UserProfile.create({
        userId: user.id,
        firstName: 'Steve',
        lastName: 'Kite'
    });
}