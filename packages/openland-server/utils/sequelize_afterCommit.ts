import Sequelize from 'sequelize';
import * as shimmer from 'shimmer';
import { createTracer } from 'openland-log/createTracer';
import { STraceContext } from 'openland-log/src/STraceContext';

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

// Hacking for tracing
const tracer = createTracer('sequelize');
shimmer.wrap((Sequelize as any).Sequelize.prototype, 'query', (original) => {
    return function (this: any, sql: any, options: any) {
        let parent = STraceContext.value;
        if (parent && parent.currentSpan) {
            const span = tracer.startSpan('SQL ' + options.type, parent.currentSpan, {
                'db.statement': sql
            });
            return original.apply(this, arguments).then(
                (res: any) => {
                    span.finish();
                    return res;
                },
                (err: any) => {
                    span.finish();
                    throw err;
                });
        }
        return original.apply(this, arguments);
    };
});