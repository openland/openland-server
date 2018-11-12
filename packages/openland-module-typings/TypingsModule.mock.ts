import { injectable } from 'inversify';

@injectable()
export class TypingsModuleMock {
    
    start = () => {
        // Do nothing
    }
    
    async setTyping(uid: number, conversationId: number, type: string) {
        // Do nothing
    }

    async cancelTyping(uid: number, conversationId: number, members: number[]) {
        // Do nothing
    }
}