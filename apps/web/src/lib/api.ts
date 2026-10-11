import { RoomView, SessionResponse, SubmitResult, type ApiError as ApiErrorBody, type CreateRoomBody, type JoinRoomBody } from '@snaphunt/contracts';
import { z } from 'zod';

const EmptyResponse = z.null();
const TargetResponse = z.object({ validation: z.literal('pending') });

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorBody['code'] | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ApiOptions {
  baseUrl?: string;
  fetch?: Fetch;
}

const NETWORK_MESSAGE = "Can't reach the game. Check your connection and try again.";

export function createApi({ baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787', fetch: fetchImpl = (input, init) => fetch(input, init) }: ApiOptions = {}) {
  async function request<T>(schema: z.ZodType<T>, path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
    const { token, headers, ...rest } = init;
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, { ...rest, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } });
    } catch {
      throw new ApiError(0, 'network', NETWORK_MESSAGE);
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const error = body as Partial<ApiErrorBody> | null;
      throw new ApiError(res.status, error?.code ?? 'invalid_state', error?.message ?? 'Something went wrong. Please try again.');
    }
    return schema.parse(body);
  }

  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const room = (code: string) => `/rooms/${encodeURIComponent(code.toUpperCase())}`;

  return {
    createRoom: (body: CreateRoomBody) => request(SessionResponse, '/rooms', json(body)),
    joinRoom: (code: string, body: JoinRoomBody) => request(SessionResponse, `${room(code)}/players`, json(body)),
    getRoom: (code: string, token: string) => request(RoomView, room(code), { token }),
    startGame: (code: string, token: string) => request(RoomView, `${room(code)}/start`, { method: 'POST', token }),
    removePlayer: (code: string, token: string, playerId: string) => request(EmptyResponse, `${room(code)}/players/${encodeURIComponent(playerId)}`, { method: 'DELETE', token }),
    uploadTarget: (code: string, token: string, photo: Blob) => request(TargetResponse, `${room(code)}/target`, { method: 'PUT', token, headers: { 'content-type': 'image/jpeg' }, body: photo }),
    requestSecondClue: (code: string, token: string, clueId: string) => request(RoomView, `${room(code)}/clues/${encodeURIComponent(clueId)}/second`, { method: 'POST', token }),
    submitFind: (code: string, token: string, clueId: string, photo: Blob, idempotencyKey: string) =>
      request(SubmitResult, `${room(code)}/clues/${encodeURIComponent(clueId)}/submissions`, { method: 'POST', token, headers: { 'content-type': 'image/jpeg', 'idempotency-key': idempotencyKey }, body: photo }),
    eventsUrl: (code: string, token: string) => `${baseUrl}${room(code)}/events?token=${encodeURIComponent(token)}`,
  };
}

export type Api = ReturnType<typeof createApi>;
