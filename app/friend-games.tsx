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
};

const labels: Record<GameType, string> = {
  ludo: "Ludo",
  chess: "Chess",
  tic_tac_toe: "Tic-Tac-Toe",
};

const initialState = (type: GameType, first: string, second: string) => {
  if (type === "tic_tac_toe") return { board: Array(9).fill(null) };
  if (type === "chess") return { fen: new Chess().fen() };
  return { pieces: { [first]: [-1, -1, -1, -1], [second]: [-1, -1, -1, -1] }, dice: null };
};

export function FriendGames({ user, friends }: { user: User; friends: GameFriend[] }) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [selected, setSelected] = useState<GameRow | null>(null);
  const [friendshipId, setFriendshipId] = useState(friends[0]?.friendshipId ?? "");
  const [gameType, setGameType] = useState<GameType>("ludo");
  const [busy, setBusy] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live">("connecting");

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("friend_games")
      .select("id,friendship_id,inviter_id,opponent_id,game_type,status,state,current_turn,winner_id,updated_at")
      .or(`inviter_id.eq.${user.id},opponent_id.eq.${user.id}`)
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
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  const friendFor = (game: GameRow) =>
    friends.find((item) => item.friendshipId === game.friendship_id)?.profile;

  const invite = async () => {
    if (!supabase || !friendshipId || busy) return;
    const friend = friends.find((item) => item.friendshipId === friendshipId);
    if (!friend) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.from("friend_games").insert({
      friendship_id: friendshipId,
      inviter_id: user.id,
      opponent_id: friend.profile.id,
      game_type: gameType,
      state: initialState(gameType, user.id, friend.profile.id),
      current_turn: user.id,
    });
    setNotice(error ? error.message : `${labels[gameType]} invitation sent.`);
    setBusy(false);
    await load();
  };

  const respond = async (game: GameRow, accept: boolean) => {
    if (!supabase || game.opponent_id !== user.id) return;
    await supabase
      .from("friend_games")
      .update({ status: accept ? "active" : "declined" })
      .eq("id", game.id)
      .eq("status", "pending");
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
      .select("id,friendship_id,inviter_id,opponent_id,game_type,status,state,current_turn,winner_id,updated_at")
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
          <div><b>{labels[selected.game_type]}</b><small>Playing with {friend?.username ?? "friend"}</small></div>
          <span className={selected.current_turn === user.id ? "your-turn" : "their-turn"}>
            <i className={syncStatus} />
            {syncStatus === "connecting" ? "Connecting…" : selected.status === "finished" ? "Game finished" : selected.current_turn === user.id ? "Your turn" : "Friend’s turn"}
          </span>
        </header>
        {selected.status === "finished" ? (
          <div className="game-result"><Crown />{selected.winner_id ? (selected.winner_id === user.id ? "You won!" : `${friend?.username ?? "Your friend"} won`) : "Draw game"}</div>
        ) : null}
        {selected.game_type === "tic_tac_toe" ? <TicTacToe game={selected} userId={user.id} save={saveMove} /> : null}
        {selected.game_type === "chess" ? <ChessBoard game={selected} userId={user.id} save={saveMove} /> : null}
        {selected.game_type === "ludo" ? <LudoBoard game={selected} userId={user.id} save={saveMove} /> : null}
        {notice ? <p className="game-notice">{notice}</p> : null}
      </div>
    );
  }

  const pending = games.filter((game) => game.status === "pending" && game.opponent_id === user.id);
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
        <label>Choose friend<select value={friendshipId} onChange={(e) => setFriendshipId(e.target.value)}>{friends.map((item) => <option key={item.friendshipId} value={item.friendshipId}>{item.profile.username}</option>)}</select></label>
        <div className="game-picker">
          {(["ludo", "chess", "tic_tac_toe"] as GameType[]).map((type) => <button key={type} className={gameType === type ? "active" : ""} onClick={() => setGameType(type)}><span>{type === "ludo" ? "🎲" : type === "chess" ? "♛" : "✕○"}</span>{labels[type]}</button>)}
        </div>
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
const RED_HOME: Array<[number, number]> = [[7,1],[7,2],[7,3],[7,4],[7,5],[7,7]];
const GREEN_HOME: Array<[number, number]> = [[1,7],[2,7],[3,7],[4,7],[5,7],[7,7]];

function tokenCell(position: number, color: "red" | "green", index: number): [number, number] {
  if (position < 0) return (color === "red" ? RED_BASE : GREEN_BASE)[index];
  if (position >= 52) return (color === "red" ? RED_HOME : GREEN_HOME)[Math.min(position - 52, 5)];
  const start = color === "red" ? 0 : 13;
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

function LudoBoard({ game, userId, save }: { game: GameRow; userId: string; save: SaveMove }) {
  const [rolling, setRolling] = useState(false);
  const pieces = (game.state.pieces as Record<string, number[]>) ?? {};
  const rivalId = opponent(game, userId);
  const mineColor = game.inviter_id === userId ? "red" : "green";
  const rivalColor = mineColor === "red" ? "green" : "red";
  const mine = pieces[userId] ?? [-1,-1,-1,-1];
  const theirs = pieces[rivalId] ?? [-1,-1,-1,-1];
  const dice = typeof game.state.dice === "number" ? game.state.dice : null;
  const roll = () => {
    if (game.current_turn !== userId || dice !== null || rolling) return;
    setRolling(true);
    window.setTimeout(() => {
      const value = Math.floor(Math.random()*6)+1;
      const canMove = mine.some((position) => position >= 0 ? position + value <= 57 : value === 6);
      setRolling(false);
      void save(game, { ...game.state, dice: canMove ? value : null }, canMove ? userId : rivalId);
    }, 520);
  };
  const move = (index: number) => {
    if (game.current_turn !== userId || dice === null) return;
    const current = mine[index];
    const nextPosition = current < 0 && dice === 6 ? 0 : current >= 0 && current + dice <= 57 ? current + dice : current;
    if (nextPosition === current) return;
    const nextMine = [...mine]; nextMine[index] = nextPosition;
    const nextTheirs = [...theirs];
    if (nextPosition < 52 && ![0,8,13,21,26,34,39,47].includes(nextPosition)) {
      const landing = tokenCell(nextPosition, mineColor, index).join("-");
      nextTheirs.forEach((position, rivalIndex) => {
        if (position >= 0 && position < 52 && tokenCell(position, rivalColor, rivalIndex).join("-") === landing)
          nextTheirs[rivalIndex] = -1;
      });
    }
    const nextPieces = { ...pieces, [userId]: nextMine, [rivalId]: nextTheirs };
    const won = nextMine.every((position) => position === 57);
    void save(game, { pieces: nextPieces, dice: null }, won ? null : dice === 6 ? userId : rivalId, won ? userId : null, won);
  };
  const trackSet = new Set(LUDO_PATH.map(([row,col]) => `${row}-${col}`));
  return (
    <div className="ludo-game">
      <div className="ludo-board-pro">
        <div className="ludo-base base-red"><b>{mineColor === "red" ? "YOU" : "FRIEND"}</b></div>
        <div className="ludo-base base-green"><b>{mineColor === "green" ? "YOU" : "FRIEND"}</b></div>
        <div className="ludo-base base-blue" />
        <div className="ludo-base base-yellow" />
        {Array.from({ length: 225 }, (_, index) => {
          const row = Math.floor(index / 15), col = index % 15, key = `${row}-${col}`;
          const lane = row === 7 && col > 0 && col < 6 ? "lane-red" : col === 7 && row > 0 && row < 6 ? "lane-green" : row === 7 && col > 8 && col < 14 ? "lane-yellow" : col === 7 && row > 8 && row < 14 ? "lane-blue" : "";
          if (!trackSet.has(key) && !lane) return null;
          const safe = [[6,1],[2,6],[1,8],[6,12],[8,13],[12,8],[13,6],[8,2]].some(([r,c]) => r===row && c===col);
          return <span key={key} className={`ludo-cell ${lane} ${safe ? "safe" : ""}`} style={{ gridRow: row+1, gridColumn: col+1 }}>{safe ? "★" : ""}</span>;
        })}
        <div className="ludo-finish"><span /><span /><span /><span /><b>Z</b></div>
        {theirs.map((position,index) => { const [row,col]=tokenCell(position,rivalColor,index); return <span key={`rival${index}`} className={`ludo-token token-${rivalColor}`} style={{gridRow:row+1,gridColumn:col+1}}><i /></span>; })}
        {mine.map((position,index) => { const [row,col]=tokenCell(position,mineColor,index); const movable=dice !== null && (position < 0 ? dice===6 : position+dice<=57); return <button key={`mine${index}`} className={`ludo-token token-${mineColor} ${movable ? "movable" : ""}`} style={{gridRow:row+1,gridColumn:col+1}} onClick={() => move(index)} disabled={!movable}><i /></button>; })}
      </div>
      <div className="ludo-controls">
        <button className="dice-button-pro" onClick={roll} disabled={game.current_turn !== userId || dice !== null || rolling}>
          <DiceFace value={rolling ? null : dice} rolling={rolling} />
          <strong>{rolling ? "ROLLING…" : dice ? `DICE ${dice}` : game.current_turn === userId ? "ROLL DICE" : "WAIT"}</strong>
        </button>
        <p>{dice ? "Tap your glowing token" : game.current_turn === userId ? "Your turn — roll the dice" : "Waiting for your friend’s move"}</p>
      </div>
    </div>
  );
}
