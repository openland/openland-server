import { graphqlExpress, graphiqlExpress } from "apollo-server-express";
import * as bodyParser from "body-parser";
import * as express from "express";
import { filter, find } from "lodash";
import { makeExecutableSchema } from 'graphql-tools';

const app = express();

const typeDefs = `
    type Author {
    id: Int!
    firstName: String
    lastName: String
    posts: [Post] # the list of Posts by this author
  }
  type Post {
    id: Int!
    title: String
    author: Author
    votes: Int
  }
  # the schema allows the following query:
  type Query {
    posts: [Post]
    author(id: Int!): Author
  }
  # this schema allows the following mutation:
  type Mutation {
    upvotePost (
      postId: Int!
    ): Post
  }
`;

// example data
const authors = [
  { id: 1, firstName: "Tom", lastName: "Coleman" },
  { id: 2, firstName: "Sashko", lastName: "Stubailo" },
  { id: 3, firstName: "Mikhail", lastName: "Novikov" },
];

const posts = [
  { id: 1, authorId: 1, title: "Introduction to GraphQL", votes: 2, did: 1 },
  { id: 2, authorId: 2, title: "Welcome to Meteor", votes: 3, did: 2 },
  { id: 3, authorId: 2, title: "Advanced GraphQL", votes: 1, did: 3 },
  { id: 4, authorId: 3, title: "Launchpad is Cool", votes: 7, did: 3 },
];
const resolvers = {
  Query: {
    posts: () => posts,
    author: (_: any, params: { id: number }) => find(authors, { id: params.id }),
  },
  Mutation: {
    upvotePost: (a: any, param: { postId: number }) => {
      console.warn(a)
      const post = find(posts, { id: param.postId });
      if (!post) {
        throw new Error(`Couldn't find post with id ${param.postId}`);
      }
      post.votes += 1;
      return post;
    },
  },
  Author: {
    posts: function (author: { id: number }) {
      return filter(posts, { authorId: author.id })
    }
  },
  Post: {
    author: (post: { did: number }) => find(authors, { id: post.did }),
  },
};

var schema = makeExecutableSchema({ typeDefs: [typeDefs], resolvers: resolvers })

app.use("/graphql", bodyParser.json(), graphqlExpress({ schema: schema }));
app.use('/sandbox', graphiqlExpress({ endpointURL: '/graphql' }));

// Starting
var port = process.env.PORT
var dport = 3000
if (port != undefined && port != "") {
  dport = parseInt(process.env.PORT as string)
}
app.listen(dport);
