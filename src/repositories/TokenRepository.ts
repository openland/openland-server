import { DB } from '../tables';
import { randomBytes } from 'crypto';
import * as base64 from '../utils/base64';

export class TokenRepository {
    async createToken(uid: number) {
        let res = await DB.UserToken.create({
            userId: uid,
            tokenSalt: base64.encodeBuffer(randomBytes(64))
        });
        return res.tokenSalt!!;
    }

    async fetchUserByToken(token: string) {
        let res = await DB.UserToken.findOne({
            where: {
                tokenSalt: token
            }
        });
        if (res !== null) {
            return res.userId!!;
        } else {
            return null;
        }
    }
}