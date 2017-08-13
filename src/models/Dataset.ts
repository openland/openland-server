import { DB } from '../tables'

export const Schema = `
    type DataSet {
        id: ID!
        name: String!
        description: String!
        link: String!
        kind: DataSetKind!
    }
    enum DataSetKind { DOCUMENT, DATASET }
    extend type Project {
        datasets(kind: DataSetKind): [DataSet!]
    }
`

export const Resolver = {
    Project: {
        async datasets(segment: { _dbid: number }, args: { kind?: string }) {
            var datasets = (await DB.DataSet.findAll({
                where: {
                    segment: segment._dbid
                }
            }))

            return datasets.map((args) => {
                return {
                    _dbid: args.id,
                    id: args.id,
                    name: args.name,
                    description: args.description,
                    link: args.link,
                    kind: args.kind
                }
            });
        }
    }
}