import { DB, DB_SILENT } from '../tables';
import { randomBytes } from 'crypto';
import * as base64 from '../utils/base64';
import DataLoader from 'dataloader';
import { Transaction } from 'sequelize';

export class TokenRepository {

    private loader = new DataLoader<string, { uid: number, tid: number } | null>(async (tokens) => {
        let foundTokens = await DB.UserToken.findAll({
            where: {
                tokenSalt: {
                    $in: tokens
                }
            },
            logging: DB_SILENT
        });
        let res: ({ uid: number, tid: number } | null)[] = [];
        for (let i of tokens) {
            let found = false;
            for (let f of foundTokens) {
                if (i === f.tokenSalt) {
                    res.push({ uid: f.userId!!, tid: f.id!! });
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

    async createToken(uid: number, tx?: Transaction) {
        let res = await DB.UserToken.create({
            userId: uid,
            tokenSalt: base64.encodeBuffer(randomBytes(64))
        }, { transaction: tx });
        return res.tokenSalt!!;
    }

    async fetchUserByToken(token: string) {
        return this.loader.load(token);
    }
}