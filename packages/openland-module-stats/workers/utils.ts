import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { MessageInput } from '../../openland-module-messaging/MessageInput';
import { boldString, buildMessage, heading, insaneString } from '../../openland-utils/MessageBuilder';
import { inTx } from '@openland/foundationdb';
import moment from 'moment';

export const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
export const getOnboardingReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'onboarding-reports-chat-id');
export const getEngagementReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'engagement-reports-chat-id');
export const getLeaderboardsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'leaderboards-chat-id');

export const getOnboardingCounters = async (ctx: Context, startDate: number) => {
    let activationsData = await Modules.Search.search(ctx, {
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
    let newUserEntrances = (activationsData.hits.total as any).value;

    const newMobileUsersQuery = await Modules.Search.search(ctx, {
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
    const newMobileUsers = (newMobileUsersQuery.hits.total as any).value;

    const newSendersQuery = await Modules.Search.search(ctx, {
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
    const newSenders = (newSendersQuery.hits.total as any).value;

    const newInvitersQuery = await Modules.Search.search(ctx, {
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
    const newInviters = (newInvitersQuery.hits.total as any).value;

    const newThreeLikeGiversQuery = await Modules.Search.search(ctx, {
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
    const newThreeLikeGivers = (newThreeLikeGiversQuery.hits.total as any).value;

    const newThreeLikeGettersQuery = await Modules.Search.search(ctx, {
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
    const newThreeLikeGetters = (newThreeLikeGettersQuery.hits.total as any).value;

    let newAboutFillersData = await Modules.Search.search(ctx, {
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

export const getEngagementCounters = async (ctx: Context, startDate: number) => {
    let activesData = await Modules.Search.search(ctx, {
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

    let sendersData = await Modules.Search.search(ctx, {
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
                },
            },
        }, size: 0,
    });

    let senders = sendersData.aggregations.senders.value;
    let messagesSent = (sendersData.hits.total as any).value;

    let todayLikersData = await Modules.Search.search(ctx, {
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
                        field: 'body.messageAuthorId',
                    },
                },
            },
        }, size: 0,
    });
    let todayLikeGivers = todayLikersData.aggregations.givers.value;
    let todayLikeGetters = todayLikersData.aggregations.getters.value;

    let callsData = await Modules.Search.search(ctx, {
        index: 'hyperlog', type: 'hyperlog',
        body: {
            query: {
                bool: {
                    must: [{ term: { type: 'call_ended' } }, {
                        range: {
                            date: {
                                gte: startDate,
                            },
                        },
                    }],
                },
            }, aggs: {
                totalDuration: {
                    sum: {
                        field: 'body.duration',
                    },
                },
            },
        }, size: 0,
    });
    let totalCallsDuration = callsData.aggregations.totalDuration.value;

    return {
        actives,
        senders,
        todayLikeGivers,
        todayLikeGetters,
        messagesSent,
        totalCallsDuration: Math.round(moment.duration(totalCallsDuration).asMinutes())
    };
};

export const alertIfRecord = async (
    parent: Context,
    cid: number,
    metricName: string,
    value: number,
    build: (prevRecord: number, currentRecord: number) => MessageInput,
) => {
    return await inTx(parent, async ctx => {
        let botId = await getSuperNotificationsBotId(ctx);
        if (!botId) {
            return;
        }

        let metric = await Store.StatsRecords.byId(metricName);
        let prevValue = await metric.get(ctx);
        if (value > prevValue) {
            metric.set(ctx, value);

            await Modules.Messaging.sendMessage(ctx, cid, botId, {
                ...build(prevValue, value),
            });
        }
    });
};

export const alertIfRecordDelta = async (
    parent: Context,
    cid: number,
    metricName: string,
    value: number,
    build: (prevRecord: number, currentRecord: number) => MessageInput,
) => {
    return await inTx(parent, async ctx => {
        let botId = await getSuperNotificationsBotId(ctx);
        if (!botId) {
            return;
        }

        let metric = await Store.StatsRecords.byId(metricName);
        let metricDelta = await Store.StatsRecords.byId(metricName + '-delta');

        let prevValue = await metric.get(ctx);
        let maxDelta = await metricDelta.get(ctx);

        metric.set(ctx, value);
        if ((value - prevValue) > maxDelta) {
            metricDelta.set(ctx, value - prevValue);

            await Modules.Messaging.sendMessage(ctx, cid, botId, {
                ...build(maxDelta, value - prevValue),
            });
        }
    });
};

export const buildDailyRecordAlert = (metricTitle: string) => {
    return (prevRecord: number, currentRecord: number) => buildMessage(heading(`${metricTitle} count have reached `,
        insaneString(currentRecord.toString()), ' today!',
    ), '\nPrevious record was ', boldString(prevRecord.toString()));
};

export const buildWeeklyRecordAlert = (metricTitle: string) => {
    return (prevRecord: number, currentRecord: number) => buildMessage(heading(`${metricTitle} count have reached `,
        insaneString(currentRecord.toString()), ' this week!',
    ), '\nPrevious record was ', boldString(prevRecord.toString()));
};