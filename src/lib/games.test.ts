import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getPaginatedGames,
    getTotalGameCount,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns the total game count', async () => {
        await seedGames(db, 4);
        expect(await getTotalGameCount(db)).toBe(4);
    });

    it('returns paginated games and metadata', async () => {
        await seedGames(db, 5);
        const page = await getPaginatedGames(db, { page: 2, pageSize: 2 });
        expect(page.games.map((g) => g.title)).toEqual(['Game 03', 'Game 04']);
        expect(page.totalGames).toBe(5);
        expect(page.totalPages).toBe(3);
        expect(page.hasPreviousPage).toBe(true);
        expect(page.hasNextPage).toBe(true);
    });

    it('clamps pagination to the last page when page is out of range', async () => {
        await seedGames(db, 3);
        const page = await getPaginatedGames(db, { page: 99, pageSize: 2 });
        expect(page.page).toBe(2);
        expect(page.games.map((g) => g.title)).toEqual(['Game 03']);
        expect(page.hasPreviousPage).toBe(true);
        expect(page.hasNextPage).toBe(false);
    });

    it('uses fallback pagination values for invalid page and page size', async () => {
        await seedGames(db, 3);
        const page = await getPaginatedGames(db, { page: 0, pageSize: 0 });
        expect(page.page).toBe(1);
        expect(page.pageSize).toBe(9);
        expect(page.games.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
    });

    it('returns empty pagination metadata for an empty database', async () => {
        const page = await getPaginatedGames(db, { page: 1, pageSize: 5 });
        expect(page.games).toEqual([]);
        expect(page.totalGames).toBe(0);
        expect(page.totalPages).toBe(0);
        expect(page.hasPreviousPage).toBe(false);
        expect(page.hasNextPage).toBe(false);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
