export const Resolvers = {
    Query: {
        pushSettings: () => ({
            webPushKey: process.env.WEB_PUSH_PUBLIC
        })
    }
};