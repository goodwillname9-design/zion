"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { ArrowLeft, Crown, Gamepad2, Swords } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import type { ZionProfile } from "./experience";

export type GameFriend = {
  friendshipId: string;
  profile: ZionProfile;
};

type GameType = "ludo" | "chess" | "tic_tac_toe";
type GameRow = {
  id: string;
  friendship_id: string;
  inviter_id: string;
  opponent_id: string;
  game_type: GameType;
  status: "pending" | "active" | "declined" | "finished";
  state: Record<string, unknown>;
  current_turn: string | null;
  winner_id: string | null;
  updated_at: string;
  participant_ids: string[];
  accepted_ids: string[];
};

const labels: Record<GameType, string> = {
  ludo: "Ludo",
  chess: "Chess",
  tic_tac_toe: "Tic-Tac-Toe",
};

const initialState = (type: GameType, players: string[]) => {
  if (type === "tic_tac_toe") return { board: Array(9).fill(null) };
  if (type === "chess") return { fen: new Chess().fen() };
  return { pieces: Object.fromEntries(players.map((id) => [id, [-1, -1, -1, -1]])), dice: null };
};

export function FriendGames({ user, friends, initialGameId, onInitialGameOpened }: { user: User; friends: GameFriend[]; initialGameId?: string | null; onInitialGameOpened?: () => void }) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [selected, setSelected] = useState<GameRow | null>(null);
  const [friendshipId, setFriendshipId] = useState(friends[0]?.friendshipId ?? "");
  const [ludoFriendships, setLudoFriendships] = useState<string[]>(friends[0]?.friendshipId ? [friends[0].friendshipId] : []);
  const [gameType, setGameType] = useState<GameType>("ludo");
  const [busy, setBusy] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live">("connecting");

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("friend_games")
      .select("id,friendship_id,inviter_id,opponent_id,game_type,status,state,current_turn,winner_id,updated_at,participant_ids,accepted_ids")
      .contains("participant_ids", [user.id])
      .in("status", ["pending", "active", "finished"])
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) setNotice(error.message);
    else {
      const rows = (data as GameRow[] | null) ?? [];
      setGames(rows);
      setSelected((current) => rows.find((row) => row.id === current?.id) ?? current);
    }
  }, [user.id]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void load();
    const channel = client
      .channel(`friend-games-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_games" }, (event) => {
        const incoming = event.new as GameRow;
        if (!incoming?.id) return void load();
        setGames((current) => [incoming, ...current.filter((item) => item.id !== incoming.id)]);
        setSelected((current) => current?.id === incoming.id ? incoming : current);
      })
      .subscribe((status) => setSyncStatus(status === "SUBSCRIBED" ? "live" : "connecting"));
    return () => void client.removeChannel(channel);
  }, [load, user.id]);

  useEffect(() => {
    if (!initialGameId) return;
    const invitedGame = games.find((game) => game.id === initialGameId && game.accepted_ids?.includes(user.id));
    if (!invitedGame) return;
    setSelected(invitedGame);
    onInitialGameOpened?.();
  }, [games, initialGameId, onInitialGameOpened, user.id]);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  const friendFor = (game: GameRow) => friends.find((item) => game.participant_ids?.includes(item.profile.id))?.profile;
  const playerName = (id: string) => id === user.id ? "You" : friends.find((item) => item.profile.id === id)?.profile.username ?? "Friend";

  const invite = async () => {
    if (!supabase || busy) return;
    const chosenIds = gameType === "ludo" ? ludoFriendships.slice(0, 3) : [friendshipId];
    const chosen = chosenIds.map((id) => friends.find((item) => item.friendshipId === id)).filter((item): item is GameFriend => Boolean(item));
    if (!chosen.length) return;
    const players = [user.id, ...chosen.map((item) => item.profile.id)];
    setBusy(true);
    setNotice("");
    const { error } = await supabase.from("friend_games").insert({
      friendship_id: chosen[0].friendshipId,
      inviter_id: user.id,
      opponent_id: chosen[0].profile.id,
      participant_ids: players,
      accepted_ids: [user.id],
      game_type: gameType,
      state: initialState(gameType, players),
      current_turn: user.id,
    });
    setNotice(error ? error.message : `${labels[gameType]} invitation sent.`);
    setBusy(false);
    await load();
  };

  const respond = async (game: GameRow, accept: boolean) => {
    if (!supabase || !game.participant_ids.includes(user.id)) return;
    const { data, error } = await supabase.rpc("respond_zion_game", { p_game_id: game.id, p_accept: accept });
    if (error) return setNotice(error.message);
    if (accept) {
      const fresh = Array.isArray(data) ? data[0] : data;
      setSelected((fresh as GameRow | null) ?? { ...game, accepted_ids: [...game.accepted_ids, user.id] });
    }
    await load();
  };

  const saveMove = async (
    game: GameRow,
    state: Record<string, unknown>,
    nextTurn: string | null,
    winner: string | null = null,
    finished = false,
  ) => {
    if (!supabase || game.current_turn !== user.id || moveBusy) return false;
    setMoveBusy(true);
    const optimistic: GameRow = {
      ...game,
      state,
      current_turn: nextTurn,
      winner_id: winner,
      status: finished ? "finished" : "active",
    };
    setSelected(optimistic);
    setGames((current) => current.map((item) => item.id === game.id ? optimistic : item));
    const { data, error } = await supabase
      .from("friend_games")
      .update({ state, current_turn: nextTurn, winner_id: winner, status: finished ? "finished" : "active" })
      .eq("id", game.id)
      .eq("status", "active")
      .eq("current_turn", user.id)
      .eq("updated_at", game.updated_at)
      .select("id,friendship_id,inviter_id,opponent_id,game_type,status,state,current_turn,winner_id,updated_at,participant_ids,accepted_ids")
      .single();
    if (error) {
      setNotice("That turn already changed. Board refreshed.");
      await load();
    } else if (data) {
      const fresh = data as GameRow;
      setSelected(fresh);
      setGames((current) => current.map((item) => item.id === fresh.id ? fresh : item));
    }
    setMoveBusy(false);
    return !error;
  };

  if (selected) {
    const friend = friendFor(selected);
    return (
      <div className="game-room">
        <header>
          <button onClick={() => setSelected(null)}><ArrowLeft /></button>
          <div><b>{labels[selected.game_type]}</b><small>{selected.participant_ids.map(playerName).join(" · ")}</small></div>
          <span className={selected.current_turn === user.id ? "your-turn" : "their-turn"}>
            <i className={syncStatus} />
            {syncStatus === "connecting" ? "Connecting…" : selected.status === "finished" ? "Game finished" : selected.current_turn === user.id ? "Your turn" : "Friend’s turn"}
          </span>
        </header>
        {selected.status === "pending" ? <div className="game-result"><Swords /> Waiting for all invited players to accept…</div> : null}
        {selected.status === "finished" ? (
          <div className="game-result"><Crown />{selected.winner_id ? (selected.winner_id === user.id ? "You won!" : `${friend?.username ?? "Your friend"} won`) : "Draw game"}</div>
        ) : null}
        {selected.status !== "pending" && selected.game_type === "tic_tac_toe" ? <TicTacToe game={selected} userId={user.id} save={saveMove} /> : null}
        {selected.status !== "pending" && selected.game_type === "chess" ? <ChessBoard game={selected} userId={user.id} save={saveMove} /> : null}
        {selected.status !== "pending" && selected.game_type === "ludo" ? <LudoBoard game={selected} userId={user.id} friends={friends} save={saveMove} /> : null}
        {notice ? <p className="game-notice">{notice}</p> : null}
      </div>
    );
  }

  const pending = games.filter((game) => game.status === "pending" && game.participant_ids.includes(user.id) && !game.accepted_ids.includes(user.id));
  return (
    <div className="games-hub">
      <div className="games-title"><Gamepad2 /><div><h2>Play with Friends</h2><p>Realtime private games · invitation required</p></div></div>
      {pending.map((game) => (
        <div className="game-invite" key={game.id}>
          <Swords /><div><b>{friendFor(game)?.username ?? "A friend"}</b><small>invited you to {labels[game.game_type]}</small></div>
          <button onClick={() => void respond(game, false)}>Decline</button>
          <button className="accept" onClick={() => void respond(game, true)}>Play</button>
        </div>
      ))}
      <div className="new-game-card">
        <div className="game-picker">
          {(["ludo", "chess", "tic_tac_toe"] as GameType[]).map((type) => <button key={type} className={gameType === type ? "active" : ""} onClick={() => setGameType(type)}><span>{type === "ludo" ? "🎲" : type === "chess" ? "♛" : "✕○"}</span>{labels[type]}</button>)}
        </div>
        {gameType === "ludo" ? (
          <div className="ludo-player-picker"><b>Invite up to 3 friends ({ludoFriendships.length}/3)</b>{friends.map((item) => <label key={item.friendshipId}><input type="checkbox" checked={ludoFriendships.includes(item.friendshipId)} onChange={() => setLudoFriendships((current) => current.includes(item.friendshipId) ? current.filter((id) => id !== item.friendshipId) : current.length < 3 ? [...current, item.friendshipId] : current)} />{item.profile.avatar} {item.profile.username}</label>)}</div>
        ) : <label>Choose friend<select value={friendshipId} onChange={(e) => setFriendshipId(e.target.value)}>{friends.map((item) => <option key={item.friendshipId} value={item.friendshipId}>{item.profile.username}</option>)}</select></label>}
        <button className="send-game-invite" disabled={!friends.length || busy} onClick={() => void invite()}>Send game invitation</button>
      </div>
      <h3>Recent games</h3>
      <div className="game-list">
        {games.filter((game) => game.status !== "pending").map((game) => <button key={game.id} onClick={() => setSelected(game)}><span>{game.game_type === "ludo" ? "🎲" : game.game_type === "chess" ? "♛" : "✕○"}</span><div><b>{labels[game.game_type]}</b><small>{friendFor(game)?.username ?? "Friend"} · {game.status}</small></div><strong>Open</strong></button>)}
      </div>
      {notice ? <p className="game-notice">{notice}</p> : null}
    </div>
  );
}

type SaveMove = (game: GameRow, state: Record<string, unknown>, next: string | null, winner?: string | null, finished?: boolean) => Promise<boolean>;
const opponent = (game: GameRow, userId: string) => game.inviter_id === userId ? game.opponent_id : game.inviter_id;

function TicTacToe({ game, userId, save }: { game: GameRow; userId: string; save: SaveMove }) {
  const board = (game.state.board as Array<string | null>) ?? Array(9).fill(null);
  const mark = game.inviter_id === userId ? "X" : "O";
  const play = (index: number) => {
    if (game.current_turn !== userId || board[index]) return;
    const next = [...board]; next[index] = mark;
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const won = wins.some((line) => line.every((cell) => next[cell] === mark));
    const draw = !won && next.every(Boolean);
    void save(game, { board: next }, won || draw ? null : opponent(game, userId), won ? userId : null, won || draw);
  };
  return <div className="tic-board">{board.map((cell, index) => <button key={index} className={cell ? `mark-${cell.toLowerCase()}` : ""} onClick={() => play(index)}>{cell}</button>)}</div>;
}

function ChessBoard({ game, userId, save }: { game: GameRow; userId: string; save: SaveMove }) {
  const chess = useMemo(() => new Chess(String(game.state.fen ?? new Chess().fen())), [game.state.fen]);
  const [from, setFrom] = useState("");
  const squares = useMemo(() => {
    const result: Array<{ square: string; piece: string; dark: boolean }> = [];
    const icons: Record<string, string> = { wp:"♙",wn:"♘",wb:"♗",wr:"♖",wq:"♕",wk:"♔",bp:"♟",bn:"♞",bb:"♝",br:"♜",bq:"♛",bk:"♚" };
    chess.board().forEach((rank, row) => rank.forEach((piece, col) => result.push({ square: `${"abcdefgh"[col]}${8-row}`, piece: piece ? icons[`${piece.color}${piece.type}`] : "", dark: (row+col)%2===1 })));
    return result;
  }, [chess]);
  const click = (square: string) => {
    if (game.current_turn !== userId) return;
    if (!from) { setFrom(square); return; }
    try {
      chess.move({ from, to: square, promotion: "q" });
      const finished = chess.isGameOver();
      const won = chess.isCheckmate();
      void save(game, { fen: chess.fen() }, finished ? null : opponent(game, userId), won ? userId : null, finished);
    } catch { /* select a different piece */ }
    setFrom("");
  };
  return <div className="chess-board">{squares.map((item) => <button key={item.square} className={`${item.dark ? "dark" : "light"} ${from === item.square ? "selected" : ""}`} onClick={() => click(item.square)}><span>{item.piece}</span><small>{item.square}</small></button>)}</div>;
}

const LUDO_PATH: Array<[number, number]> = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
const RED_BASE: Array<[number, number]> = [[1,1],[1,4],[4,1],[4,4]];
const GREEN_BASE: Array<[number, number]> = [[1,10],[1,13],[4,10],[4,13]];
const BLUE_BASE: Array<[number, number]> = [[10,1],[10,4],[13,1],[13,4]];
const YELLOW_BASE: Array<[number, number]> = [[10,10],[10,13],[13,10],[13,13]];
const RED_HOME: Array<[number, number]> = [[7,1],[7,2],[7,3],[7,4],[7,5],[7,7]];
const GREEN_HOME: Array<[number, number]> = [[1,7],[2,7],[3,7],[4,7],[5,7],[7,7]];
const BLUE_HOME: Array<[number, number]> = [[13,7],[12,7],[11,7],[10,7],[9,7],[7,7]];
const YELLOW_HOME: Array<[number, number]> = [[7,13],[7,12],[7,11],[7,10],[7,9],[7,7]];
type LudoColor = "red" | "green" | "yellow" | "blue";
const colorOrder: LudoColor[] = ["red", "green", "yellow", "blue"];
const playerNameForLudo = (id: string | undefined, userId: string, friends: GameFriend[]) => {
  if (!id) return "OPEN";
  if (id === userId) return "YOU";
  return friends.find((item) => item.profile.id === id)?.profile.username ?? "FRIEND";
};

function tokenCell(position: number, color: LudoColor, index: number): [number, number] {
  const bases = { red: RED_BASE, green: GREEN_BASE, yellow: YELLOW_BASE, blue: BLUE_BASE };
  const homes = { red: RED_HOME, green: GREEN_HOME, yellow: YELLOW_HOME, blue: BLUE_HOME };
  if (position < 0) return bases[color][index];
  if (position >= 52) return homes[color][Math.min(position - 52, 5)];
  const start = { red: 0, green: 13, yellow: 26, blue: 39 }[color];
  return LUDO_PATH[(start + position) % LUDO_PATH.length];
}

function DiceFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  const active: Record<number, number[]> = {
    1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8],
  };
  return (
    <span className={`dice-cube ${rolling ? "rolling" : ""}`}>
      {Array.from({ length: 9 }, (_, index) => <i key={index} className={value && active[value].includes(index) ? "pip" : ""} />)}
    </span>
  );
}

function LudoBoard({ game, userId, friends, save }: { game: GameRow; userId: string; friends: GameFriend[]; save: SaveMove }) {
  const [rolling, setRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState(1);
  const pieces = (game.state.pieces as Record<string, number[]>) ?? {};
  const players = game.participant_ids?.length ? game.participant_ids : [game.inviter_id, game.opponent_id];
  const mineColor = colorOrder[Math.max(0, players.indexOf(userId))];
  const mine = pieces[userId] ?? [-1,-1,-1,-1];
  const nextPlayer = () => players[(players.indexOf(userId) + 1) % players.length];
  const dice = typeof game.state.dice === "number" ? game.state.dice : null;
  const roll = () => {
    if (game.current_turn !== userId || dice !== null || rolling) return;
    setRolling(true);
    const spin = window.setInterval(() => setRollingValue(Math.floor(Math.random() * 6) + 1), 65);
    window.setTimeout(() => {
      window.clearInterval(spin);
      const value = Math.floor(Math.random()*6)+1;
      const canMove = mine.some((position) => position >= 0 ? position + value <= 57 : value === 6);
      setRolling(false);
      setRollingValue(value);
      void save(game, { ...game.state, dice: canMove ? value : null }, canMove ? userId : nextPlayer());
    }, 520);
  };
  const move = (index: number) => {
    if (game.current_turn !== userId || dice === null) return;
    const current = mine[index];
    const nextPosition = current < 0 && dice === 6 ? 0 : current >= 0 && current + dice <= 57 ? current + dice : current;
    if (nextPosition === current) return;
    const nextMine = [...mine]; nextMine[index] = nextPosition;
    const nextPieces = { ...pieces, [userId]: nextMine };
    let captured = false;
    if (nextPosition < 52 && ![0,8,13,21,26,34,39,47].includes(nextPosition)) {
      const landing = tokenCell(nextPosition, mineColor, index).join("-");
      players.filter((id) => id !== userId).forEach((id) => {
        const rivalColor = colorOrder[players.indexOf(id)];
        const rivalPieces = [...(pieces[id] ?? [-1,-1,-1,-1])];
        rivalPieces.forEach((position, rivalIndex) => { if (position >= 0 && position < 52 && tokenCell(position, rivalColor, rivalIndex).join("-") === landing) { rivalPieces[rivalIndex] = -1; captured = true; } });
        nextPieces[id] = rivalPieces;
      });
    }
    const won = nextMine.every((position) => position === 57);
    void save(game, { pieces: nextPieces, dice: null }, won ? null : dice === 6 || captured ? userId : nextPlayer(), won ? userId : null, won);
  };
  const trackSet = new Set(LUDO_PATH.map(([row,col]) => `${row}-${col}`));
  return (
    <div className="ludo-game">
      <div className="ludo-board-pro">
        {colorOrder.map((color) => <div key={color} className={`ludo-base base-${color}`}><b>{players[colorOrder.indexOf(color)] ? playerNameForLudo(players[colorOrder.indexOf(color)], userId, friends) : "OPEN"}</b></div>)}
        {Array.from({ length: 225 }, (_, index) => {
          const row = Math.floor(index / 15), col = index % 15, key = `${row}-${col}`;
          const lane = row === 7 && col > 0 && col < 6 ? "lane-red" : col === 7 && row > 0 && row < 6 ? "lane-green" : row === 7 && col > 8 && col < 14 ? "lane-yellow" : col === 7 && row > 8 && row < 14 ? "lane-blue" : "";
          if (!trackSet.has(key) && !lane) return null;
          const safe = [[6,1],[2,6],[1,8],[6,12],[8,13],[12,8],[13,6],[8,2]].some(([r,c]) => r===row && c===col);
          return <span key={key} className={`ludo-cell ${lane} ${safe ? "safe" : ""}`} style={{ gridRow: row+1, gridColumn: col+1 }}>{safe ? "★" : ""}</span>;
        })}
        <div className="ludo-finish"><span /><span /><span /><span /><b>Z</b></div>
        {players.filter((id) => id !== userId).flatMap((id) => { const color = colorOrder[players.indexOf(id)]; return (pieces[id] ?? [-1,-1,-1,-1]).map((position,index) => { const [row,col]=tokenCell(position,color,index); return <span key={`${id}-${index}`} className={`ludo-token token-${color}`} style={{gridRow:row+1,gridColumn:col+1}}><i /></span>; }); })}
        {mine.map((position,index) => { const [row,col]=tokenCell(position,mineColor,index); const movable=dice !== null && (position < 0 ? dice===6 : position+dice<=57); return <button key={`mine${index}`} className={`ludo-token token-${mineColor} ${movable ? "movable" : ""}`} style={{gridRow:row+1,gridColumn:col+1}} onClick={() => move(index)} disabled={!movable}><i /></button>; })}
      </div>
      <div className="ludo-controls">
        <button className="dice-button-pro" onClick={roll} disabled={game.current_turn !== userId || dice !== null || rolling}>
          <DiceFace value={rolling ? rollingValue : dice ?? 1} rolling={rolling} />
          <strong>{rolling ? "ROLLING…" : dice ? `DICE ${dice}` : game.current_turn === userId ? "ROLL DICE" : "WAIT"}</strong>
        </button>
        <p>{dice ? "Tap your glowing token" : game.current_turn === userId ? "Your turn — roll the dice" : "Waiting for your friend’s move"}</p>
      </div>
    </div>
  );
}
