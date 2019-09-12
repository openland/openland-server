import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';

export const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
export const getOnboardingReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'onboarding-reports-chat-id');
export const getEngagementReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'engagement-reports-chat-id');
export const getLeaderboardsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'leaderboards-chat-id');

export const getOnboardingCounters = async (startDate: number) => {
    let activationsData = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
        body: {
            query: {
                bool: {
                    must: [{ term: { type: 'user_activated' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            },
        }, size: 0,
    });
    let newUserEntrances = activationsData.hits.total;

    const newMobileUsersQuery = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-mobile-user' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            },
        }, size: 0,
    });
    const newMobileUsers = newMobileUsersQuery.hits.total;

    const newSendersQuery = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-sender' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            },
        }, size: 0,
    });
    const newSenders = newSendersQuery.hits.total;

    const newInvitersQuery = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-inviter' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            },
        }, size: 0,
    });
    const newInviters = newInvitersQuery.hits.total;

    const newThreeLikeGiversQuery = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-three-like-giver' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            },
        }, size: 0,
    });
    const newThreeLikeGivers = newThreeLikeGiversQuery.hits.total;

    const newThreeLikeGettersQuery = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-three-like-getter' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            },
        }, size: 0,
    });
    const newThreeLikeGetters = newThreeLikeGettersQuery.hits.total;

    let newAboutFillersData = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
        body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-about-filler' } }, { term: { ['body.isTest']: false } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            }, aggs: {
                usersCount: {
                    cardinality: {
                        field: 'body.uid',
                    },
                },
            },
        }, size: 0,
    });
    let newAboutFillers = newAboutFillersData.aggregations.usersCount.value;

    return {
        newUserEntrances,
        newMobileUsers,
        newSenders,
        newInviters,
        newAboutFillers,
        newThreeLikeGivers,
        newThreeLikeGetters,
    };
};

export const getEngagementCounters =  async (startDate: number) => {
    let activesData = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
        body: {
            query: {
                bool: {
                    must: [{ term: { type: 'presence' } }, { term: { ['body.online']: true } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            }, aggs: {
                actives: {
                    cardinality: {
                        field: 'body.uid',
                    },
                },
            },
        }, size: 0,
    });

    let actives = activesData.aggregations.actives.value;

    let sendersData = await Modules.Search.elastic.client.search({
        index: 'message', type: 'message',
        body: {
            query: {
                bool: {
                    must: [{ term: { isService: false } }, {
                        range: {
                            createdAt: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            }, aggs: {
                senders: {
                    cardinality: {
                        field: 'uid',
                    },
                }
            },
        }, size: 0,
    });

    let senders = sendersData.aggregations.senders.value;
    let messagesSent = sendersData.hits.total;

    let todayLikersData = await Modules.Search.elastic.client.search({
        index: 'hyperlog', type: 'hyperlog', // scroll: '1m',
        body: {
            query: {
                bool: {
                    must: [{ term: { type: 'new-reaction' } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }, { term: { ['body.isTest']: false } }],
                },
            }, aggs: {
                givers: {
                    cardinality: {
                        field: 'body.uid',
                    },
                },
                getters: {
                    cardinality: {
                        field: 'body.messageAuthorId'
                    }
                }
            },
        }, size: 0,
    });
    let todayLikeGivers = todayLikersData.aggregations.givers.value;
    let todayLikeGetters = todayLikersData.aggregations.getters.value;

    return {
        actives,
        senders,
        todayLikeGivers,
        todayLikeGetters,
        messagesSent
    };
};