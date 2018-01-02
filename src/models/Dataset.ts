import { DB, DataSet } from '../tables';
import { CallContext } from './CallContext';

export const Schema = `
    type DataSet {
        id: ID!
        name: String!
        description: String!
        url: String!
        kind: String!
        group: String
    }
    extend type Query {
        datasets(kind: String): [DataSet!]
    }
    extend type Mutation {
        createDataset(name: String!, url: String!, kind: String!, description: String!, group: String): DataSet!
        alterDataset(id: ID!, newName: String, newUrl: String, newKind: String, newDescription: String, newGroup: String): DataSet!
        deleteDataset(id: ID!): ID
    }
`;

function convertDataset(dataset: DataSet) {
    return {
        _dbid: dataset.id,
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        url: dataset.link,
        kind: dataset.kind,
        group: dataset.group
    };
}

function checkKind(kind: string) {
    if (['document', 'dataset', 'link', 'data-need'].indexOf(kind) < 0) {
        throw 'Kind ' + kind + 'is invalid';
    }
}

export const Resolver = {
    Query: {
        async datasets(_: any, args: { kind?: string }, context: CallContext) {
            let datasets = (await DB.DataSet.findAll({
                where: {
                    account: context.accountId
                }
            }));

            return datasets.map(convertDataset);
        }
    },
    Mutation: {
        createDataset: async (_: any, args: { name: string, url: string, kind: string, description: string, group?: string }, context: CallContext) => {
            context.requireWriteAccess();
            checkKind(args.kind);
            let created = await DB.DataSet.create({
                name: args.name,
                description: args.description,
                account: context.accountId,
                kind: args.kind,
                link: args.url
            });
            return convertDataset(created);
        },
        alterDataset: async (_: any, args: { id: string, newName?: string, newUrl?: string, newKind?: string, newDescription?: string, newGroup?: string }, context: CallContext) => {
            context.requireWriteAccess();
            let updated = (await DB.DataSet.findOne({
                where: {
                    id: parseInt(args.id, 10)
                }
            }));
            if (updated == null) {
                throw 'Dataset not found';
            }
            if (args.newName != null) {
                updated.name = args.newName;
            }
            if (args.newUrl != null) {
                updated.link = args.newUrl;
            }
            if (args.newDescription != null) {
                updated.description = args.newDescription;
            }
            if (args.newKind != null) {
                checkKind(args.newKind);
                updated.kind = args.newKind;
            }
            if (args.newGroup != null) {
                updated.group = args.newGroup;
            }
            await updated.save();
            return convertDataset(updated);
        },
        deleteDataset: async (_: any, args: { id: string }, context: CallContext) => {
            context.requireWriteAccess();
            let toDelete = (await DB.DataSet.findOne({
                where: {
                    id: parseInt(args.id, 10)
                }
            }));
            if (toDelete == null) {
                return null;
            } else {
                await toDelete.destroy();
                return args.id;
            }
        }
    }
};