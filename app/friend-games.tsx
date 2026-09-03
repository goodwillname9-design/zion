"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { ArrowLeft, Crown, Dices, Gamepad2, Swords } from "lucide-react";
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
  const [notice, setNotice] = useState("");

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
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_games" }, () => void load())
      .subscribe();
    return () => void client.removeChannel(channel);
  }, [load, user.id]);

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
    if (!supabase || game.current_turn !== user.id) return false;
    const { error } = await supabase
      .from("friend_games")
      .update({ state, current_turn: nextTurn, winner_id: winner, status: finished ? "finished" : "active" })
      .eq("id", game.id)
      .eq("status", "active")
      .eq("current_turn", user.id)
      .eq("updated_at", game.updated_at);
    if (error) setNotice("That turn already changed. Board refreshed.");
    await load();
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
            {selected.status === "finished" ? "Game finished" : selected.current_turn === user.id ? "Your turn" : "Friend’s turn"}
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

function LudoBoard({ game, userId, save }: { game: GameRow; userId: string; save: SaveMove }) {
  const pieces = (game.state.pieces as Record<string, number[]>) ?? {};
  const mine = pieces[userId] ?? [-1,-1,-1,-1];
  const dice = typeof game.state.dice === "number" ? game.state.dice : null;
  const roll = () => {
    if (game.current_turn !== userId || dice !== null) return;
    const value = Math.floor(Math.random()*6)+1;
    const canMove = mine.some((position) => position >= 0 ? position + value <= 40 : value === 6);
    void save(game, { ...game.state, dice: canMove ? value : null }, canMove ? userId : opponent(game,userId));
  };
  const move = (index: number) => {
    if (game.current_turn !== userId || dice === null) return;
    const current = mine[index];
    const nextPosition = current < 0 && dice === 6 ? 0 : current >= 0 && current + dice <= 40 ? current + dice : current;
    if (nextPosition === current) return;
    const nextMine = [...mine]; nextMine[index] = nextPosition;
    const nextPieces = { ...pieces, [userId]: nextMine };
    const won = nextMine.every((position) => position === 40);
    void save(game, { pieces: nextPieces, dice: null }, won ? null : dice === 6 ? userId : opponent(game,userId), won ? userId : null, won);
  };
  return <div className="ludo-game"><div className="ludo-board"><div className="ludo-home red">{mine.map((position,index) => <button key={index} onClick={() => move(index)} title={`Piece ${index+1}: ${position < 0 ? "home" : position === 40 ? "finished" : position}`}><i style={{ transform: `translateY(${-Math.min(Math.max(position,0),40)*2}px)` }} /></button>)}</div><div className="ludo-track">{Array.from({length:40},(_,i)=><span key={i} className={i%4===0 ? "safe" : ""} />)}</div><div className="ludo-center">ZION</div></div><button className="dice-button" onClick={roll} disabled={game.current_turn !== userId || dice !== null}><Dices />{dice ?? "ROLL"}</button><p>{dice ? "Choose a piece to move" : "Roll the dice on your turn"}</p></div>;
}
