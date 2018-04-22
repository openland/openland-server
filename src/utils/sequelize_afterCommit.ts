import Sequelize from 'sequelize';
import * as shimmer from 'shimmer';

//
// Sequelize doesn't have afterCommit hook in transaction and here we are extending transaction prototype
// replacing default commit behaviour to support afterCommit method.
// TODO: How to make everything typesafe?
//

// Hacking sequelize
(Sequelize as any).Transaction.prototype.afterCommit = function (cb: any) {
    if (!this.afterCommitHooks) {
        this.afterCommitHooks = [];
    }
    this.afterCommitHooks.push(cb);
};

shimmer.wrap((Sequelize as any).Transaction.prototype, 'commit', (original) => {
    return async function (this: any) {
        let res = await original.apply(this, arguments);
        if (this.afterCommitHooks) {
            for (let a of this.afterCommitHooks as any[]) {
                await a();
            }
        }
        return res;
    };
});