import { DB } from '../tables';
import { randomBytes } from 'crypto';
import * as base64 from '../utils/base64';
import DataLoader from 'dataloader';

export class TokenRepository {

    private loader = new DataLoader<string, number | null>(async (tokens) => {
        let foundTokens = await DB.UserToken.findAll({
            where: {
                tokenSalt: {
                    $in: tokens
                }
            }
        });
        let res: (number | null)[] = [];
        for (let i of tokens) {
            let found = false;
            for (let f of foundTokens) {
                if (i === f.tokenSalt) {
                    res.push(f.userId!!);
                    found = true;
                    break;
                }
            }
            if (!found) {
                res.push(null);
            }
        }
        return res;
    });

    async createToken(uid: number) {
        let res = await DB.UserToken.create({
            userId: uid,
            tokenSalt: base64.encodeBuffer(randomBytes(64))
        });
        return res.tokenSalt!!;
    }

    async fetchUserByToken(token: string) {
        return this.loader.load(token);
    }
}