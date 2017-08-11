import { DB } from '../tables'

export const Schema = `
    type DataSet {
        id: ID!
        name: String!
        description: String!
        link: String!
    }
    enum DataSetKind { REPORT, DATASET }
    extend type Project {
        datasets(kind: DataSetKind): [DataSet!]
    }
`

export const Resolver = {
    Project: {
        async datasets(segment: { _dbid: number }, args: { kind?: string }) {
            var datasets = await DB.DataSet.findAll({
                where: {
                    segment: segment._dbid
                }
            }).all()

            return datasets.map((args: { id: number, name: string, description: string, link: string }) => {
                return {
                    _dbid: args.id,
                    id: args.id,
                    name: args.name,
                    description: args.description,
                    link: args.link
                }
            });
        }
    }
}