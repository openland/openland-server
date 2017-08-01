import { graphqlExpress, graphiqlExpress } from "apollo-server-express";
import * as bodyParser from "body-parser";
import * as express from "express";
import * as Schema from './schema';
import * as cors from 'cors';

export default async function () {
    const app = express();

    // Routes
    app.use(cors())
    app.use("/graphql", bodyParser.json(), graphqlExpress({ schema: Schema.Schema }));
    app.use('/sandbox', graphiqlExpress({ endpointURL: '/graphql' }));

    // Starting Api
    var port = process.env.PORT
    var dport = 9000
    if (port != undefined && port != "") {
        dport = parseInt(process.env.PORT as string)
    }
    app.listen(dport);
}
