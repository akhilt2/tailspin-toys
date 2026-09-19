import { eq, asc, count } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

export interface GamesPaginationOptions {
    page: number;
    pageSize: number;
}

export interface PaginatedGamesResult {
    games: Game[];
    page: number;
    pageSize: number;
    totalGames: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function toPositiveInteger(value: number, fallback: number): number {
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** Total number of games in the catalog. */
export async function getTotalGameCount(db: Database): Promise<number> {
    const total = await db.select({ value: count() }).from(games).get();
    return total?.value ?? 0;
}

/** Games for a page ordered by title with pagination metadata. */
export async function getPaginatedGames(db: Database, options: GamesPaginationOptions): Promise<PaginatedGamesResult> {
    const pageSize = toPositiveInteger(options.pageSize, 9);
    const requestedPage = toPositiveInteger(options.page, 1);
    const totalGames = await getTotalGameCount(db);
    const totalPages = totalGames === 0 ? 0 : Math.ceil(totalGames / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const rows = await baseGamesQuery(db).orderBy(asc(games.title)).limit(pageSize).offset(offset);

    return {
        games: rows.map(mapGame),
        page,
        pageSize,
        totalGames,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: totalPages > 0 && page < totalPages,
    };
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
