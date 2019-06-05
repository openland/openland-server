import { injectable } from 'inversify';
import { DiscoverData } from './DiscoverData';

@injectable()
export class DiscoverModule {
    private data = new DiscoverData();

    nextPage = (selectedTags: string[], exludedGroups: string[]) => {
        return this.data.next(selectedTags, exludedGroups);
    }

    suggestedChats = (selectedTags: string[]) => {
        return this.data.resolveSuggestedChats(selectedTags);
    }
    start = () => {
        // Nothing to do
    }
}