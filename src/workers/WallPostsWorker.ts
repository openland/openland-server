import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import { Services } from '../services';
import { URLInfo } from '../modules/UrlInfo';

export function createWallPostsWorker() {
    let queue = new WorkQueue<{ postId: number }, { result: string }>('wall_post_task');
    queue.addWorker(async (item) => {
        let post = await DB.WallPost.findById(item.postId);

        if (!post) {
            return { result: 'ok' };
        }

        if (post.extras!.links) {
            type Link = { url: string, text: string, extraInfo?: URLInfo };
            let links: Link[] = post.extras!.links as any;

            if (links.length === 0) {
                return { result: 'ok' };
            }

            if (links[0].extraInfo) {
                return { result: 'ok' };
            }

            for (let link of links) {
                let info = await Services.URLInfo.fetchURLInfo(link.url);

                link.extraInfo = info;
            }

            await post.update({
                extras: {
                    ...post.extras,
                    links
                }
            });
        }

        return { result: 'ok' };
    });
    return queue;
}