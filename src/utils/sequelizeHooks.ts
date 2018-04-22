import * as sequelize from 'sequelize';

export function addAfterChangedCommitHook<TInstance, TAttributes>(model: sequelize.Model<TInstance, TAttributes>, handler: (instante: TInstance) => any) {
    model.addHook('afterCreate', (record: TInstance, options: { transaction?: sequelize.Transaction }) => {
        if (options.transaction && (options.transaction as any).afterCommit) {
            (options.transaction as any).afterCommit(() => {
                return handler(record);
            });
        } else {
            return handler(record);
        }
    });
    model.addHook('afterUpdate', (record: TInstance, options: { transaction?: sequelize.Transaction }) => {
        if (options.transaction && (options.transaction as any).afterCommit) {
            (options.transaction as any).afterCommit(() => {
                return handler(record);
            });
        } else {
            return handler(record);
        }
    });
}