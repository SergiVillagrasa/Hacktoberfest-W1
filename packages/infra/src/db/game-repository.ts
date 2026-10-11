import { and, asc, desc, eq, notInArray } from 'drizzle-orm';
import { GameError, type Clue, type DomainEvent, type Game, type GameRepository, type Player, type StoredEvent, type Target } from '@snaphunt/core';
import type { Db } from './client';
import { clues, events, players, rooms, targets } from './schema';

const roomColumns = (g: Game) => ({
  code: g.code,
  status: g.status,
  phase: g.phase,
  timeLimitMs: g.timeLimitMs,
  countdownEndsAt: g.countdownEndsAt,
  endsAt: g.endsAt,
  finishedAt: g.finishedAt,
});

async function writeChildren(tx: Db, game: Game, tokenHashes: Record<string, string>, evs: DomainEvent[]) {
  const roomId = game.roomId;
  await tx.delete(players).where(and(eq(players.roomId, roomId), notInArray(players.id, game.players.map((p) => p.id))));
  for (const p of game.players) {
    const fields = { nickname: p.nickname, isCreator: p.isCreator, status: p.status, failedAttempts: p.failedAttempts };
    const tokenHash = tokenHashes[p.id];
    if (tokenHash) {
      await tx.insert(players).values({ id: p.id, roomId, ...fields, tokenHash, joinedAt: p.joinedAt }).onConflictDoUpdate({ target: players.id, set: fields });
    } else {
      await tx.update(players).set(fields).where(eq(players.id, p.id));
    }
  }
  for (const t of game.targets) {
    const fields = { imagePath: t.imagePath, validation: t.validation, rejectReason: t.rejectReason, foundBy: t.foundBy, foundAt: t.foundAt, points: t.points, assets: t.assets };
    await tx.insert(targets).values({ id: t.id, roomId, ownerId: t.ownerId, ...fields }).onConflictDoUpdate({ target: targets.id, set: fields });
  }
  for (const c of game.clues) {
    const fields = { issuedAt: c.issuedAt, secondClueUsed: c.secondClueUsed, judgeBusyServed: c.judgeBusyServed, status: c.status };
    await tx.insert(clues).values({ id: c.id, roomId, targetId: c.targetId, hunterId: c.hunterId, kind: c.kind, ...fields }).onConflictDoUpdate({ target: clues.id, set: fields });
  }
  if (evs.length) await tx.insert(events).values(evs.map(({ type, at, ...payload }) => ({ roomId, at, type, payload })));
}

export function createGameRepository(db: Db): GameRepository {
  return {
    async create(game, tokenHashes) {
      await db.transaction(async (tx) => {
        await tx.insert(rooms).values({ id: game.roomId, ...roomColumns(game), version: game.version });
        await writeChildren(tx, game, tokenHashes, []);
      });
    },

    async loadByCode(code) {
      const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
      if (!room) return null;
      const [ps, ts, cs] = await Promise.all([
        db.select().from(players).where(eq(players.roomId, room.id)).orderBy(asc(players.joinedAt), asc(players.id)),
        db.select().from(targets).where(eq(targets.roomId, room.id)),
        db.select().from(clues).where(eq(clues.roomId, room.id)).orderBy(asc(clues.issuedAt), asc(clues.id)),
      ]);
      return {
        roomId: room.id,
        code: room.code,
        status: room.status as Game['status'],
        phase: room.phase as Game['phase'],
        timeLimitMs: room.timeLimitMs,
        countdownEndsAt: room.countdownEndsAt,
        endsAt: room.endsAt,
        finishedAt: room.finishedAt,
        version: room.version,
        players: ps.map(({ roomId: _r, tokenHash: _t, ...p }) => p as Player),
        targets: ts.map(({ roomId: _r, ...t }) => t as Target),
        clues: cs.map(({ roomId: _r, ...c }) => c as Clue),
      };
    },

    async findPlayerByTokenHash(hash) {
      const [row] = await db.select({ roomCode: rooms.code, playerId: players.id }).from(players).innerJoin(rooms, eq(rooms.id, players.roomId)).where(eq(players.tokenHash, hash));
      return row ?? null;
    },

    async save(game, evs, tokenHashes = {}) {
      return db.transaction(async (tx) => {
        const updated = await tx
          .update(rooms)
          .set({ ...roomColumns(game), version: game.version + 1 })
          .where(and(eq(rooms.id, game.roomId), eq(rooms.version, game.version)))
          .returning({ version: rooms.version });
        if (updated.length === 0) throw new GameError('version_conflict', 'Game changed, please retry');
        await writeChildren(tx, game, tokenHashes, evs);
        return { ...game, version: updated[0]!.version };
      });
    },

    async version(code) {
      const [row] = await db.select({ version: rooms.version }).from(rooms).where(eq(rooms.code, code));
      return row?.version ?? null;
    },

    async recentEvents(roomId, limit) {
      const rows = await db.select().from(events).where(eq(events.roomId, roomId)).orderBy(desc(events.id)).limit(limit);
      return rows.reverse().map((r) => ({ ...(r.payload as object), id: r.id, type: r.type, at: r.at }) as StoredEvent);
    },
  };
}
