import { IDs } from 'openland-module-api/IDs';

export type Tag = { id: string, title: string, score: number };
export type TagGroup = { id: string, title?: string, subtitle?: string, tags: Tag[], score: number };

// https://www.notion.so/openland/8db9400948ef4c7cb6ddf626c5cd87b6?v=cfb89c13d283453e8abba074f20ef469
const _data = `Name,Link,Role,Founder_sub_1,Founder_sub_2,Engineer_sub,all triggers
Score: 4 (in the end of recommendations list),,,,,,
Openland News,https://openland.com/mail/p/EQvPJ1LamRtJJ9ppVxDDs30Jzw,"Community manager,Creative,Designer,Educator,Engineer,Event organizer,Founder,Investor,Marketer,Other roles,Product manager,Recruiter,Sales",,,,"Founder, Investor, Product manager, Engineer, Designer, Recruiter, Community manager, Other roles, Event organizer, Creative, Educator, Marketer, Sales, "
Founder Chats,https://openland.com/mail/p/ZYx4d9K6kjIZ5jo6r69zc4AX3v,Founder,,,,"Founder, "
Founders · Random,https://openland.com/mail/3Ym4RrOAbxIMAa43Qv1WFDymz4,Founder,,,,"Founder, "
Founder Radio,https://openland.com/mail/mJvq41O5gATb6DyDdEzEhkRbdQ,Founder,,,,"Founder, "
Investor Chats,https://next.openland.com/mail/mJvq41O5gEF61xQBMx6bikPKrE,Investor,,,,"Investor, "
Product Chats,https://openland.com/mail/rAb139w0Mzc4XrgvdxvEH5DYRO,Product manager,,,,"Product manager, "
Professional education,https://openland.com/mail/WD69pr1lAOHowbWYAQlzTkW0n6,Product manager,,,,"Product manager, "
Openland Tech,https://openland.com/mail/p/LOLqoerbADtq4xDP0dBzuwJwx3,Engineer,,,,"Engineer, "
Engineer Chats,https://openland.com/mail/p/VywdDrg3byuRx0dqmyaRfrR7Pb,Engineer,,,,"Engineer, "
Engineers · Random,https://openland.com/mail/p/Y96dY7aOP9UAMLbZpoAJHdqdKg,Engineer,,,,"Engineer, "
Engineering Jobs,https://openland.com/mail/AL1ZPXB976hJqDXe0PWOSoM7a6,Engineer,,,,"Engineer, "
International Jobs,https://openland.com/mail/ygJmWn5qKkUwp5AO1A3QUM45Qa,Engineer,,,,"Engineer, "
Remote engineers,https://openland.com/mail/61MyVnm7YDfzqmJvMzR6Ul6RXb,Engineer,,,,"Engineer, "
Designers,https://openland.com/mail/nqoZQV6zYwSRZbAX0jzZSOBpdQ,Designer,,,,"Designer, "
Designer Jobs,https://openland.com/mail/mJvq41O5g5i6WRb016m3s3rEd7,Designer,,,,"Designer, "
Designer Tools,https://openland.com/mail/4dmAE76O03uXyKXqVA7aib1mWP,Designer,,,,"Designer, "
Deck design,https://openland.com/mail/LOLqoerbA1iKvXpxjzo1tee1gK,Designer,,,,"Designer, "
Russian Designers,https://openland.com/mail/4dmAE76O09uAXMyEKOoZTJpDjn,Designer,,,,"Designer, "
Design Systems · In Russian,https://openland.com/mail/3Ym4RrOAbofj43qXKM4kTPDmMA,Designer,,,,"Designer, "
Recruiters,https://openland.com/mail/9KkDvyowQRIokdMbxwZDulkyvX,Recruiter,,,,"Recruiter, "
Hiring Signals,https://openland.com/mail/Rgq6MV7Q5pixaP9LyXPRs703aY,Recruiter,,,,"Recruiter, "
Digital Nomads,https://openland.com/mail/3Ym4RrOAbxI1qm94Byk3fpd9yy,Other roles,,,,"Other roles, "
Community Managers 😎,https://openland.com/mail/p/Rgq6MV7Q5gCb6r53E1koT7BMBZ,Community manager,,,,"Community manager, "
Event Organizers,https://openland.com/mail/mJvq41O5gOh7xrvgrJ1PhzmQq7,Event organizer,,,,"Event organizer, "
Internet Creators,https://openland.com/mail/k4awPklKgPcOLzWyeDD6Sre5xV,Creative,,,,"Creative, "
Interactive Video,https://openland.com/mail/4dmAE76O0DSqZV5KK3XDS9EZvo,Creative,,,,"Creative, "
Animation,https://openland.com/mail/Ko0zOxqje6FMXokEvOkXiWAprm,Creative,,,,"Creative, "
Artists,https://openland.com/mail/zoqLwdzrEPH6zmyXxjowt3o94z,Creative,,,,"Creative, "
Professional education,https://openland.com/mail/WD69pr1lAOHowbWYAQlzTkW0n6,Educator,,,,"Educator, "
Growth,https://openland.com/mail/VywdDrg3AJfkdXYkMznpibbnWJ,Marketer,,,,"Marketer, "
Referral Systems,https://openland.com/mail/dB6k5PZDyvFQJ6gb9p6jTezYL7,Marketer,,,,"Marketer, "
Influencer Marketing,https://openland.com/mail/9KkDvyow0VUWLKQ0YDkPi4dR4v,Marketer,,,,"Marketer, "
Mobile Marketing,https://openland.com/mail/Rgq6MV7QA4URg7abqz6zf4lj7y,Marketer,,,,"Marketer, "
Affiliate Marketing,https://openland.com/mail/jZVjLe3a7euy7erLDd6WSKaxjV,Marketer,,,,"Marketer, "
Twitter Marketing,https://openland.com/mail/0DW7dl3rzvcBZD0DreR0fgy9Xk,Marketer,,,,"Marketer, "
Local Marketing,https://openland.com/mail/rAb139w0MKuJBlvYJbrLuVA3nQ,Marketer,,,,"Marketer, "
Sales Professionals,https://openland.com/mail/1pm4Xrl3B9uzm1JmdvwmsWqkDd,Sales,,,,"Sales, "
Sales Tools,https://openland.com/mail/7Vd4aLWmZoCDop4LXAd4I15ydO,Sales,,,,"Sales, "
Sales Jobs,https://openland.com/mail/LOLqoerbA3HrZ53Epl99cEybAQ,Sales,,,,"Sales, "
,,,,,,
Score: 2,,,,,,
Proptech,https://openland.com/mail/p/EQvPJ1LaODS1WAAx65wVI3m55l,,Proptech,,,
The Future of Messaging,https://openland.com/mail/p/ZYx4d9K6VmhljdO6qm5pi7ORMB,,Messaging,,,
Fintech Founders,https://openland.com/directory/r/nqoZQV6zYXIWAk34Qak1UMMeeZ,,Fintech,,,
Future of Payments,https://openland.com/mail/Jlb4AOJBxQskQV00dDl6CbdnOX,,Fintech,,,
Marketing Tech Founders,https://openland.com/directory/r/wW4975KQkLixVAznByLlTO1Mna,,Marketing Tech,,,
HR Tech Founders,https://openland.com/directory/r/0DW7dl3rzJFvjn5m0vELuxA3Xq,,HR Tech,,,
Media Founders,https://openland.com/directory/r/9KkDvyowQmCRx7MpJ6LghDvXkA,,Media,,,
Healthcare Founders,https://openland.com/directory/r/b5RYKeLkwWixOd6BO94OFyqxDP,,Healthcare,,,
Social Apps Founders,https://openland.com/directory/r/mJvq41O57dsbEXWqDy9yCzdAEr,,Social apps,,,
Dev Tools Founders,https://openland.com/directory/r/b5RYKeLkwgtPE7q3r5kAhvowlW,,Dev Tools,,,
Local Tech Founders,https://openland.com/directory/r/jZVjLe3a7YfEKvb6PAY5CXWBdo,,Local Tech,,,
EdTech Founders,https://openland.com/directory/r/vmZR69a4k0FoVWZXZk7zHBakbn,,EdTech,,,
Ecommerce Founders,https://openland.com/mail/g065jdJYwku3WXVk5RweFlDmaD,,Ecommerce,,,
Productivity Tech Founders,https://openland.com/directory/r/vmZR69a4k0FP1knWjYyWsBP95J,,Productivity Tech,,,
Transportation Founders,https://openland.com/directory/r/b5RYKeLkwWimlnLrrWxdtYqZQe,,Transportation,,,
Security Founders,https://openland.com/directory/r/b5RYKeLkw5FK3BOWoRk1ulYo5v,,Security,,,
AI Founders,https://openland.com/mail/Om49WwAP7BspmarAvko0fWPj1R,,AI,,,
AR/VR Founders,https://openland.com/directory/r/dB6k5PZDyoUdYvlJkRmeCekQe5,,AR / VR,,,
Crypto Founders,https://openland.com/directory/r/zoqLwdzrE5CMJpgkRrmZTWeReK,,Cryptocurrencies,,,
SaaS Founders,https://openland.com/mail/mJvq41O57dsqWMbzL5okUzJgEP,,SaaS,,,
Marketplace Founders,https://openland.com/mail/dB6k5PZDyoUOgOzWr73yi7VjDm,,Marketplace,,,
Hardware Founders,https://openland.com/directory/r/BPV0ZljY7PtKZp3X9LQaUaenWX,,Hardware,,,
Mental Health Founders,https://openland.com/directory/r/qljZr9Wb7VFwq4epebo4Uaqk1w,,Mental Health,,,
Parenting Tech,https://openland.com/directory/r/Ko0zOxqjenu5mve3QD7VIWQnOe,,Parenting Tech,,,
Travel Tech Founders,https://openland.com/directory/r/zoqLwdzrErcQq33MPbPRfQZZpZ,,Travel Tech,,,
Gaming Founders,https://openland.com/directory/r/av6pa90nyvTVVKrzPkD4ij6dkx,,Gaming,,,
Future of Gaming,https://openland.com/mail/b5RYKeLkzviZK4qzeXwdFgJL6Z,,Gaming,,,
Food Tech Founders,https://openland.com/mail/jZVjLe3a7pUBmBRDxPWjHoP7bw,,Food Tech,,,
Clean meat,https://openland.com/mail/xwQxobvJgWu67mAv0XQ7UOA93Y,,Food Tech,,,
Ag Tech Founders,https://openland.com/directory/r/9KkDvyowQRImMglYKJAOc40JQ6,,AgTech,,,
Biotech Founders,https://openland.com/directory/r/wW4975KQkDf74YmLABoEsMq3WR,,Biotech,,,
Fashion Tech Founders,https://openland.com/directory/r/orzRJa7oMecnnPDexZLzTpjXd0,,Fashion Tech,,,
Urbantech Founders,https://openland.com/mail/p/jZVjLe3a7ZCLDmZOPb9otP5jxM,,Urbantech,,,
Cities of the Future,https://openland.com/mail/xwQxobvJ6nFwgAmrLMQaUg57pk,,Urbantech,,,
Legal Tech,https://openland.com/directory/r/ZYx4d9K6kPFZArMYBpxkS0Brdp,,Legal Tech,,,
Hard Tech Founders,https://openland.com/directory/r/7Vd4aLWmZRFPPBAnl5x9fPJPor,,Hard Tech,,,
Nonprofit Founders,https://openland.com/directory/r/M6Pl7R30AmCvZZ31pXzdidVb33,,Nonprofit,,,
MusicTech Founders,https://openland.com/directory/r/Ko0zOxqjeyUagOeQlWEZT49JmO,,Music Tech,,,
Sports Tech,https://openland.com/mail/QwJ9g164vruO4oqJvroKuq6Zeg,,Sports Tech,,,
,,,,,,
Score: 1,,,,,,
Next Chapter,https://openland.com/mail/p/BPV0ZljY7qcAPAw709vpurpOaK,,,Next role / co-founder search,,
Market Research,https://openland.com/mail/p/Om49WwAP7Wfjezv0dBAPt4kLvb,,,Market exploration,,
CTOs,https://openland.com/directory/r/lQKjZMAv71tMWAXRlwRlF6dWWv,,,Technology development,,
Product Launch,https://openland.com/directory/r/vmZR69a4k0FoqJEJDykRIyeZ3q,,,Product launch,,
Product Feedback,https://next.openland.com/directory/r/D4KeQl0V7RH0V07lvyOvClDe1a,,,Product launch,,
Fundraising Help,https://openland.com/mail/p/4dmAE76OeWfR4qn9kdQKcZaQKy,,,Fundraising,,
Pitch Deck Review,https://openland.com/directory/r/5Xmd1J76LRujqV4zjjwrIDWBwK,,,Fundraising,,
Fundraising Tactics,https://openland.com/directory/r/jZVjLe3a4pfxmD6yOO9YUXljM7,,,Fundraising,,
Growth Chats,https://openland.com/mail/p/VywdDrg3AJfkdXYkMznpibbnWJ,,,Growth,,
B2B Sales,https://openland.com/mail/Ko0zOxqje5TRbYgjvA6xu4jAjV,,,Sales,,
Customer Leads,https://openland.com/directory/r/xwQxobvJ7BfdVopQvoBYsOkmPR,,,Sales,,
Recruiting Help,https://openland.com/directory/r/Rgq6MV7Q59TLP5lKdyXqc3MEjm,,,Recruiting,,
Services for Startups,https://openland.com/directory/r/Rgq6MV7QAPUK7XoJ5jV5I4xnBm,,,Selling to startups,,
Startup Operations,https://openland.com/mail/p/jZVjLe3a7giOmDPEgxebsKROWk,,,Operations,,
Founders · Ask for Intros,https://openland.com/mail/5Xmd1J76LRu0ZxBoYxvZswQeWz,,,Networking,,
,,,,,,
Score: 3,,,,,,
JS Jobs in the Valley,https://openland.com/mail/7Vd4aLWmOMuLBK7AQr4ZSmVQdp,Engineer,,,JS,"Engineer, "
Node JS,https://next.openland.com/mail/BPV0ZljYdehQ9wR9MoLJIrLrLa,Engineer,,,JS,"Engineer, "
React,https://openland.com/mail/xwQxobvJaBUdvQPZBw47hMl6B1,Engineer,,,React,"Engineer, "
React Native,https://openland.com/mail/p/0DW7dl3rzXCeaqVmnMY3UP703k,Engineer,,,React,"Engineer, "
Frontend,https://openland.com/mail/p/D4KeQl0V7xhJYmRpqWABflZZWM,Engineer,,,Frontend,"Engineer, "
Russian Frontend,https://openland.com/mail/Jlb4AOJBxKFqWZEeYn5XCDqrX5,Engineer,,,Frontend,"Engineer, "
FoundationDB,https://openland.com/mail/Y96dY7aO1DsL0B9rVQrrUml5q5,Engineer,,,FoundationDB,"Engineer, "
CTOs,https://openland.com/directory/r/lQKjZMAv71tMWAXRlwRlF6dWWv,Engineer,,,CTO,"Engineer, "
Backend,https://openland.com/mail/b5RYKeLkwoIpM043YrrLtYqjyn,Engineer,,,Backend,"Engineer, "
Data Scientists,https://openland.com/mail/mJvq41O5gktxezEqx0Vdf3bjRq,Engineer,,,Data Science,"Engineer, "
iOS Development,https://openland.com/mail/zoqLwdzrEmFv3Ldj0Ex1twWYDK,Engineer,,,iOS,"Engineer, "
Internet of Things,https://openland.com/mail/WD69pr1lAwhgPXPqRjbBi7AEAb,Engineer,,,Internet of Things,"Engineer, "
Payments Tech,https://openland.com/mail/D4KeQl0V7vhOddggL4lBh3LOWX,Engineer,,,Payments Tech,"Engineer, "
Voice Tech,https://openland.com/mail/xwQxobvJ7AhwwDOPY530FOW5EX,Engineer,,,Voice Tech,"Engineer, "`;

const groupMeta: { [group: string]: { score: number, title?: string, subtitle?: string } | undefined } = {
    'Role': { score: 1, title: 'Your role', subtitle: 'What roles have you played?' },
    'Founder_sub_1': { score: 2, title: 'Areas of work', subtitle: 'What areas have you worked on?' },
    'Founder_sub_2': { score: 3, title: 'Priorities', subtitle: 'What are your key priorities?' },
    'Engineer_sub': { score: 3, title: 'Tech expertise', subtitle: 'What are your areas of ​​expertise?' },
};

const tagMeta: { [tagId: string]: { sort: number } | undefined } = {
    'Role_Founder': { sort: 10 },
    'Role_Investor': { sort: 9 },
    'Role_Other roles': { sort: 0 },
};

const tagToGroup: { [tag: string]: string[] } = {
    'Role_Engineer': ['Engineer_sub'],
    'Role_Founder': ['Founder_sub_1', 'Founder_sub_2'],
};

type Chat = { id: string, tags: string[] };

export class DiscoverData {
    chats: Chat[] = [];
    tagsMap = new Map<string, Tag>();
    tagsGroupsMap = new Map<string, TagGroup>();
    constructor() {
        let split = _data.split('\n');

        let tagsGroups = split[0].split(',').map(id => id.trim());
        // init tag groups
        for (let i = 2; i < tagsGroups.length; i++) {
            let groupId = tagsGroups[i];
            let meta = groupMeta[groupId];
            let group: TagGroup = { id: tagsGroups[i], title: meta ? meta.title : undefined, score: meta ? meta.score : 1, tags: [], subtitle: meta ? meta.subtitle : undefined };
            this.tagsGroupsMap.set(tagsGroups[i], group);
        }
        for (let i = 1; i < split.length; i++) {
            let line = this.csvToArray(split[i]);
            let tags: string[] = [];

            // fill tags groups
            for (let j = 2; j < tagsGroups.length; j++) {
                let groupId = tagsGroups[j];
                let group = this.tagsGroupsMap.get(groupId)!;
                let lineTags = line[j].replace('"', '').split(',').map(s => s.trim()).filter(s => !!s);
                for (let t of lineTags) {
                    let tagId = groupId + '_' + t;
                    if (!this.tagsGroupsMap.get(groupId)!.tags.find(tag => tag.id === tagId)) {
                        let tag = { title: t, id: tagId, score: group.score };
                        this.tagsGroupsMap.get(groupId)!.tags.push(tag);
                        this.tagsMap.set(tagId, tag);
                    }
                    tags.push(tagId);
                }

                // sort tags by score from meta
                group.tags.sort((a, b) => {
                    let aMeta = tagMeta[a.id] || { sort: 1 };
                    let bMeta = tagMeta[b.id] || { sort: 1 };
                    return bMeta.sort - aMeta.sort;
                });
            }

            let linkSplit = line[1].split('/');

            // fill chat tags
            this.chats.push({ id: linkSplit[linkSplit.length - 1], tags });
        }
    }

    csvToArray = (text: string) => {
        var reValid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
        var reValue = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
        if (!reValid.test(text)) {
            return [];
        }
        var a = [];
        text.replace(reValue,
            (m0, m1, m2, m3) => {
                if (m1 !== undefined) {
                    a.push(m1.replace(/\\'/g, '\''));
                } else if (m2 !== undefined) {
                    a.push(m2.replace(/\\"/g, '"'));
                } else if (m3 !== undefined) {
                    a.push(m3);
                }
                return '';
            });
        if (/,\s*$/.test(text)) {
            a.push('');
        }
        return a;
    }

    resolveSuggestedChats = (tagsIds: string[]) => {
        let resMap = new Map<Chat, number>();
        for (let tagId of tagsIds) {
            for (let row of this.chats) {
                if (row.tags.indexOf(tagId) !== -1) {
                    // founder category is exeptional - show it only if Founder or Investor tag selected
                    // if (!row.tags.includes('Role_Founder') || [...tagsIds.values()].find(t => t === 'Role_Founder' || t === 'Role_Investor')) {
                    let tag = this.tagsMap.get(tagId);
                    resMap.set(row, (resMap.get(row) || 0) + (tag ? tag.score : 0));
                    // }
                }
            }
        }

        let suggested = [...resMap].filter(e => !!e[0].id).sort((a, b) => b[1] - a[1]).map(e => e[0]);
        let res: number[] = [];
        for (let c of suggested) {
            try {
                let cid = IDs.Conversation.parse(c.id);
                if (!res.find(r => r === cid)) {
                    res.push(cid);
                }
            } catch {
                // ignore bad links
            }
        }
        return res;
    }

    public next: (selected: string[], excludeGroups: string[]) => { tagGroup?: TagGroup, chats?: number[] } = (selected: string[], excludeGroups: string[]) => {
        let group: TagGroup | undefined;

        if (!selected.length && !excludeGroups.length) {
            group = this.tagsGroupsMap.get('Role');
        } else {
            outer: for (let s of selected) {
                let groupIds = tagToGroup[s] || [];
                for (let groupId of groupIds) {
                    if (excludeGroups.indexOf(groupId || '') !== -1) {
                        continue;
                    }
                    group = this.tagsGroupsMap.get(groupId);
                    if (group) {
                        break outer;
                    }
                }
            }
        }
        if (group) {
            return { tagGroup: group };
        } else {
            return { chats: this.resolveSuggestedChats(selected) };
        }
    }
}
