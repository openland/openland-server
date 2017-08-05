import { connection } from '../connector';
import * as sequelize from 'sequelize'

export { User } from './User';
export { Vote } from './Vote';
export { UserVote } from './UserVote';
export { Dashboard } from './Dashboard';

export async function tx<A>(handler: () => PromiseLike<A>): Promise<A> {
    return await connection.transaction((_: sequelize.Transaction) => handler());
}