import type { ClueView, FeedItem, RankedView, RecapItem, RoomView } from '@snaphunt/contracts';
import { MAX_FAILED_ATTEMPTS } from '../domain/constants';
import { GameError } from '../domain/errors';
import { rankPlayers } from '../domain/ranking';
import type { Clue, DomainEvent, Game, Target } from '../domain/types';
import type { GameRepository, ImageStore, SubmissionRepository } from '../ports';

export interface ViewDeps {
  games: GameRepository;
  submissions: SubmissionRepository;
  images: ImageStore;
}

const URL_TTL_SECONDS = 600;
const FEED_LIMIT = 30;
const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? iso(d) : null);

function feedText(e: DomainEvent, name: (id: string) => string): string {
  switch (e.type) {
    case 'game_started': return 'The hunt is on!';
    case 'target_found': return `${name(e.hunterId)} found a target (+${e.points})`;
    case 'player_eliminated': return `${name(e.playerId)} was knocked out by ${name(e.byPlayerId)}`;
    case 'visual_clue_issued': return `${name(e.hunterId)} got a picture clue`;
    case 'player_out_of_attempts': return `${name(e.playerId)} is out of attempts`;
    case 'solo_mode': return 'Solo hunt! No more eliminations';
    case 'game_finished': return 'Game over!';
  }
}

export async function getView(deps: ViewDeps, game: Game, playerId: string, now: Date): Promise<RoomView> {
  const me = game.players.find((p) => p.id === playerId);
  if (!me) throw new GameError('not_found', 'Player not found');
  const sign = async (path: string | null) => (path ? deps.images.signedUrl(path, URL_TTL_SECONDS) : null);
  const name = (id: string) => game.players.find((p) => p.id === id)?.nickname ?? 'Someone';
  const targetOf = (id: string) => game.targets.find((t) => t.id === id) as Target;
  const ranking = rankPlayers(game);
  const finished = game.status === 'finished';
  const playing = game.status === 'active' || finished;

  const clueView = async (c: Clue): Promise<ClueView> => {
    const { assets } = targetOf(c.targetId);
    const visual = c.kind === 'visual';
    const text = playing ? (visual ? assets.clues?.visual : assets.clues?.first) ?? null : null;
    return {
      id: c.id,
      kind: c.kind,
      status: c.status,
      targetId: c.targetId,
      text,
      secondText: playing && !visual && c.secondClueUsed ? assets.clues?.second ?? null : null,
      judgeBusyText: playing && c.judgeBusyServed ? assets.clues?.judgeBusy ?? null : null,
      audioUrl: playing ? await sign(visual ? assets.audio.visual : assets.audio.first) : null,
      secondAudioUrl: playing && !visual && c.secondClueUsed ? await sign(assets.audio.second) : null,
      judgeBusyAudioUrl: playing && c.judgeBusyServed ? await sign(assets.audio.judgeBusy) : null,
      hintUrl: playing && visual ? await sign(assets.hintPath) : null,
      secondClueUsed: c.secondClueUsed,
      issuedAt: iso(c.issuedAt),
    };
  };

  const watching = me.status !== 'active';
  const ownTarget = game.targets.find((t) => t.ownerId === playerId);
  const [myClues, spectatorClues, events] = await Promise.all([
    Promise.all(game.clues.filter((c) => c.hunterId === playerId).map(clueView)),
    Promise.all((watching ? game.clues.filter((c) => c.hunterId !== playerId && c.status === 'active' && playing) : []).map(clueView)),
    deps.games.recentEvents(game.roomId, FEED_LIMIT),
  ]);
  const feed: FeedItem[] = events.map((e) => ({ at: iso(e.at), type: e.type, text: feedText(e, name), photoUrl: null }));

  const matches = finished ? await deps.submissions.listMatches(game.roomId) : [];
  const findPhotoOf = (targetId: string) => matches.find((m) => game.clues.find((c) => c.id === m.clueId)?.targetId === targetId)?.imagePath ?? null;
  const recap: RecapItem[] | null = finished
    ? await Promise.all(
        game.targets.map(async (t) => ({
          targetId: t.id,
          ownerNickname: name(t.ownerId),
          finderNickname: t.foundBy ? name(t.foundBy) : null,
          originalUrl: (await sign(t.imagePath))!,
          findPhotoUrl: await sign(findPhotoOf(t.id)),
          clueText: t.assets.clues?.first ?? null,
          clueAudioUrl: await sign(t.assets.audio.first),
          hintUrl: await sign(t.assets.hintPath),
          points: t.points,
        })),
      )
    : null;

  const rankedView: RankedView[] = ranking.map((r) => ({ playerId: r.playerId, nickname: r.nickname, score: r.score, finds: r.finds, lastFindAt: isoOrNull(r.lastFindAt), rank: r.rank }));
  return {
    code: game.code,
    status: game.status,
    phase: game.phase,
    timeLimitMs: game.timeLimitMs,
    countdownEndsAt: isoOrNull(game.countdownEndsAt),
    endsAt: isoOrNull(game.endsAt),
    serverNow: iso(now),
    version: game.version,
    me: { playerId, isCreator: me.isCreator, status: me.status, failedAttempts: me.failedAttempts, attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - me.failedAttempts) },
    players: game.players.map((p) => {
      const r = ranking.find((x) => x.playerId === p.id)!;
      return { id: p.id, nickname: p.nickname, isCreator: p.isCreator, status: p.status, ready: game.targets.some((t) => t.ownerId === p.id && t.validation === 'accepted' && t.assets.clues !== null), score: r.score, finds: r.finds };
    }),
    myClues,
    spectatorClues,
    feed,
    ranking: finished ? rankedView : null,
    recap,
    myTarget: ownTarget ? { validation: ownTarget.validation, rejectReason: ownTarget.rejectReason, imageUrl: await sign(ownTarget.imagePath) } : null,
  };
}
