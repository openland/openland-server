import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs } from '../openland-module-api/IDs';

export default {
    MatchmakingRoom: {
        enabled: () => false,
        id: () => IDs.MatchmakingRoom.serialize(1),
        myProfile: () => null,
        profiles: () => null,
        questions: () => null,
    },
} as GQLResolver;