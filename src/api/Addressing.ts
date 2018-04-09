import { withAny } from './utils/Resolvers';
import { DB, State, County, City } from '../tables';
import { IDs } from './utils/IDs';
import { Repos } from '../repositories';

export const Resolvers = {
    State: {
        id: (src: State) => IDs.State.serialize(src.id!!),
        name: (src: State) => src.name,
        code: (src: State) => src.code,
    },
    County: {
        id: (src: County) => IDs.County.serialize(src.id!!),
        name: (src: County) => src.name
    },
    City: {
        id: (src: City) => IDs.City.serialize(src.id!!),
        name: (src: City) => src.name,
        county: (src: City) => Repos.Area.resolveCountyInfo(src.countyId!!),
        state: async (src: City) => Repos.Area.resolveStateInfo((await Repos.Area.resolveCountyInfo(src.countyId!!))!!.stateId!!)
    },
    Query: {
        states: withAny<{ active: boolean }>((args) => {
            if (args.active) {
                return [DB.State.findOne({ where: { code: 'CA' } }), DB.State.findOne({ where: { code: 'NY' } })];
            }
            return DB.State.findAll();
        }),
        counties: withAny<{ stateId: string }>((args) => {
            let stateId = IDs.State.parse(args.stateId);
            return DB.County.findAll({
                where: {
                    stateId: stateId
                },
                order: [['name', 'ASC']]
            });
        })
    }
};