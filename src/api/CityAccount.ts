import { DB, Account } from '../tables';
import { CallContext } from './CallContext';
import * as DataLoader from 'dataloader';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';

function convertAccount(account: Account | undefined | null, context: CallContext) {
    if (account == null || account === undefined) {
        return null;
    }
    return {
        _dbid: account.id,
        id: account.id,
        domain: account.slug,
        name: account.name,
        city: account.city,
        needAuthentication: false,
        readAccess: true,
        writeAccess: false,
        generation: account.generation
    };
}

export async function resolveAccountId(domain: string) {
    let res = (await DB.Account.findOne({
        where: {
            slug: domain
        }
    }));
    if (res == null) {
        throw new NotFoundError(ErrorText.unableToFindAccount(domain));
    }
    return res.id!!;
}

let dataLoader = new DataLoader<number, Account | null>(async (accountIds) => {
    let promises = accountIds.map((v) => DB.Account.findOne({
        where: {
            id: v,
            activated: true
        }
    }));
    let res: (Account | null)[] = [];
    for (let p of promises) {
        res.push(await p);
    }
    return res;
});

export const Resolver = {
    Query: {
        account: async function (_: any, args: {}, context: CallContext) {
            return convertAccount(await dataLoader.load(context.accountId), context);
        }
    }
};