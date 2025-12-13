import { PersistentSearchBar } from '../index';

describe('search/index.ts exports', () => {
    it('should export PersistentSearchBar component', () => {
        expect(PersistentSearchBar).toBeDefined();
        expect(typeof PersistentSearchBar).toBe('function');
    });
});
