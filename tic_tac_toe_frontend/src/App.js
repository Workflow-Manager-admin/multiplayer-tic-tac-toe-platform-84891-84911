import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

// Helper to make API requests
async function api(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  } catch (e) {
    throw new Error(e.message || 'API Error');
  }
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');
  // User/game states
  const [playerName, setPlayerName] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [activeGame, setActiveGame] = useState(null);
  const [pastGames, setPastGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);
  const [refreshGamesFlag, setRefreshGamesFlag] = useState(0);

  // UI colors/theme
  const COLORS = {
    primary: '#1976d2',
    secondary: '#424242',
    accent: '#ffb300'
  };

  // Theme switching
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch list of games (for past/resume)
  useEffect(() => {
    fetchGames();
  }, [refreshGamesFlag]);

  // Poll for latest state if in-game (basic multi-user support)
  useEffect(() => {
    if (!activeGame || activeGame.finished) return;
    const poll = setInterval(() => {
      fetchGameState(activeGame.id, false);
    }, 3200);
    return () => clearInterval(poll);
    // eslint-disable-next-line
  }, [activeGame]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  // Load games for panel/history
  async function fetchGames() {
    try {
      const data = await api('/games');
      setPastGames(data.games || []);
    } catch {
      setPastGames([]);
    }
  }

  // Start a new game
  async function createGame() {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const data = await api('/games', {
        method: 'POST',
        body: JSON.stringify({ creator: playerName }),
      });
      fetchGameState(data.id, true);
      setRefreshGamesFlag(x => x + 1);
    } catch (err) {
      setErrorMsg('Could not create game. ' + err.message);
    }
    setIsLoading(false);
  }

  // Join existing game
  async function joinGame(gameId = null) {
    setErrorMsg('');
    if (!gameId && !gameIdInput) return setErrorMsg('Enter a Game ID');
    setIsLoading(true);
    try {
      const toJoin = gameId || gameIdInput;
      await api(`/games/${toJoin}/join`, {
        method: 'POST',
        body: JSON.stringify({ player: playerName })
      });
      fetchGameState(toJoin, true);
      setRefreshGamesFlag(x => x + 1);
    } catch (err) {
      setErrorMsg('Could not join game. ' + (err.message || ''));
    }
    setIsLoading(false);
  }

  // Resume/view any previous game
  async function resumeGame(gameId) {
    setErrorMsg('');
    setIsLoading(true);
    try {
      fetchGameState(gameId, true);
    } catch {
      setErrorMsg('Could not load game');
    }
    setIsLoading(false);
  }

  // Get live game data by ID
  async function fetchGameState(gameId, activate = false) {
    try {
      const game = await api(`/games/${gameId}`);
      if (activate) setActiveGame(game);
      else setActiveGame((cur) => ({ ...(cur || {}), ...game }));
    } catch (e) {
      setErrorMsg('Game not found');
      if (activate) setActiveGame(null);
    }
  }

  // Make a move in the active game
  async function makeMove(row, col) {
    if (!activeGame || activeGame.finished || moveLoading) return;
    setMoveLoading(true);
    setErrorMsg('');
    try {
      const data = await api(`/games/${activeGame.id}/move`, {
        method: 'POST',
        body: JSON.stringify({
          player: playerName,
          row, col
        })
      });
      setActiveGame(data);
      setRefreshGamesFlag(x => x + 1);
    } catch (err) {
      setErrorMsg('Invalid move or error: ' + (err.message || ''));
    }
    setMoveLoading(false);
  }

  // Leave/reset to home state
  function leaveGame() {
    setActiveGame(null);
    setErrorMsg('');
    setMoveLoading(false);
  }

  // Render the central board for the current game
  function Board({ board, onCellClick, finished }) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,60px)',
          gridGap: 0,
          margin: '0 auto',
          boxShadow: '0 2px 12px #0001',
          border: `2px solid ${COLORS.primary}`,
          borderRadius: '10px',
          background: theme === 'light' ? '#fff' : COLORS.secondary
        }}>
        {board.map((row, i) =>
          row.map((cell, j) => (
            <button
              key={i + '' + j}
              className="ttt-cell"
              style={{
                width: 60, height: 60,
                background: cell === null ? 'transparent' : (cell === 'X' ? COLORS.accent : COLORS.primary),
                color: cell === null
                  ? COLORS.primary
                  : '#fff',
                fontSize: 28,
                fontWeight: 'bold',
                outline: 'none',
                border: '1.5px solid #e0e0e0',
                cursor: finished || cell !== null ? 'not-allowed' : 'pointer',
                transition: 'background .15s'
              }}
              onClick={() => !finished && !cell && onCellClick(i, j)}
              aria-label={`cell ${i}-${j}`}
            >{cell === null ? '' : cell}</button>
          ))
        )}
      </div>
    );
  }

  // Panel to view/resume past games
  function PastGamesPanel() {
    return (
      <section className="ttt-history-panel" style={{
        border: `1px solid ${COLORS.secondary}33`,
        background: theme === 'light' ? '#f7f9fc' : COLORS.secondary + '11',
        borderRadius: 10,
        padding: '16px 8px',
        minWidth: 210,
        marginTop: 8
      }}>
        <h3 style={{ margin: 0, color: COLORS.primary, fontSize: 16, fontWeight: 600 }}>Past Games</h3>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Click to view/resume</div>
        <div style={{ maxHeight: 210, overflowY: 'auto' }}>
          {pastGames.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 14 }}>No games found</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pastGames.slice().reverse().map(g => (
                <li key={g.id}>
                  <button
                    style={{
                      margin: '4px 0',
                      width: '100%',
                      fontSize: 13,
                      borderRadius: 4,
                      background: COLORS.primary + '05',
                      border: `1px solid ${COLORS.primary}22`,
                      color: COLORS.primary,
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '6px 8px',
                      opacity: activeGame && activeGame.id === g.id ? 0.5 : 1
                    }}
                    disabled={activeGame && activeGame.id === g.id}
                    onClick={() => resumeGame(g.id)}>
                    {g.id.slice(0, 8)} &nbsp;
                    <span style={{
                      fontWeight: 600,
                      color: g.finished ? '#b71c1c' : '#388e3c'
                    }}>
                      {g.finished ? 'Finished' : 'In Progress'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  // Winner/tie/curr. turn status string
  function GameStatusBar({ game }) {
    if (!game) return null;
    if (game.finished) {
      if (game.winner)
        return <span style={{ color: COLORS.accent, fontWeight: 700 }}>Winner: {game.winner}</span>;
      return <span style={{ color: '#b71c1c', fontWeight: 600 }}>It's a tie!</span>;
    }
    if (!game.players || game.players.length < 2)
      return <span style={{color: '#888'}}>Waiting for another player to join...</span>;
    return (
      <span style={{
        color: game.current_turn === 'X' ? COLORS.accent : COLORS.primary,
        fontWeight: 600
      }}>
        {game.players.find(p => p.symbol === game.current_turn)?.name
          ? `Current Turn: ${game.players.find(p => p.symbol === game.current_turn).name} (${game.current_turn})`
          : `Turn: ${game.current_turn}` }
      </span>
    );
  }

  // Main screen
  function renderHome() {
    return (
      <div className="ttt-home" style={{
        background: theme === 'light' ? '#fff' : COLORS.secondary,
        borderRadius: 10,
        maxWidth: 360,
        margin: '40px auto',
        padding: 26,
        boxShadow: '0 2px 18px #0002'
      }}>
        <h2 style={{color: COLORS.primary, fontSize: 24, fontWeight: 700}}>Tic Tac Toe Multiplayer</h2>
        <div style={{margin:'14px 0 8px'}}>
          <input
            style={{
              fontSize: 15,
              padding: '8px 12px',
              width: '95%',
              borderRadius: 6,
              border: `1.5px solid ${COLORS.primary}55`,
              marginBottom: 9,
              outline: 'none'
            }}
            type="text"
            placeholder="Your name"
            value={playerName}
            maxLength={20}
            onChange={e => setPlayerName(e.target.value.replace(/[^a-z0-9 _-]/gi,''))}
            aria-label="your name"
          />
        </div>
        <div style={{marginBottom:8}}>
          <button
            className="ttt-btn"
            style={{
              background: COLORS.primary,
              color: '#fff',
              padding: '8px 26px',
              borderRadius: 8,
              border: 'none',
              fontSize: 16,
              marginRight: 8,
              fontWeight: 600,
              cursor: !playerName ? 'not-allowed' : 'pointer',
              opacity: !playerName ? .5 : 1
            }}
            onClick={createGame}
            disabled={!playerName || isLoading}
          >New Game</button>
        </div>
        <div style={{marginBottom:14}}>
          <input
            style={{
              fontSize: 14,
              padding: '7px 10px',
              width: '70%',
              borderRadius: 5,
              border: `1.2px solid ${COLORS.primary}33`,
              marginRight: 8,
              outline: 'none'
            }}
            type="text"
            placeholder="Enter Game ID"
            value={gameIdInput}
            maxLength={36}
            onChange={e => setGameIdInput(e.target.value.replace(/[^a-z0-9-]/gi,''))}
            aria-label="game id"
          />
          <button
            className="ttt-btn"
            style={{
              background: COLORS.accent,
              color: '#fff',
              borderRadius: 7, border: 'none',
              padding: '7px 17px',
              fontSize: 15,
              fontWeight: 600,
              cursor: !playerName || !gameIdInput ? 'not-allowed' : 'pointer',
              opacity: !playerName || !gameIdInput ? .5 : 1
            }}
            onClick={() => joinGame()}
            disabled={!playerName || !gameIdInput || isLoading}>
            Join
          </button>
        </div>
        {errorMsg && <div style={{ color: '#e53935', margin: '5px 0 8px', fontWeight: 600, fontSize: 13 }}>{errorMsg}</div>}
        <div style={{marginTop: 20}}>
          <PastGamesPanel/>
        </div>
      </div>
    );
  }

  // In-game UI
  function renderGame() {
    if (!activeGame) return null;
    const {board, finished, winner, id, players = [], current_turn} = activeGame;
    // Who am I?
    const mySymbol = players.find(p => p.name === playerName)?.symbol;
    const opponent = players.find(p => p.name !== playerName);
    return (
      <div className="ttt-game-center" style={{
        display: 'flex', flexDirection: 'row', justifyContent: 'center',
        marginTop: 30, gap: 24, alignItems: 'flex-start'
      }}>
        {/* Main game column */}
        <section className="ttt-main-panel" style={{
          minWidth: 280,
          background: theme === 'light' ? '#fff' : COLORS.secondary,
          borderRadius: 9,
          padding: 28,
          boxShadow: '0 4px 22px #0002',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <div style={{ fontSize: 17, color: COLORS.primary, marginBottom: 7 }}>Game ID: <span style={{ fontWeight: 700 }}>{id?.slice(0,8)}</span></div>
          <GameStatusBar game={activeGame} />
          <div style={{margin: '15px 0'}}>
            <Board board={board} onCellClick={makeMove} finished={finished}/>
          </div>
          <div style={{ fontSize: 15, marginBottom: 4 }}>
            You: <span style={{ color: COLORS.accent, fontWeight: 600 }}>{playerName || '?'}</span> {mySymbol && `(${mySymbol})`}
          </div>
          <div style={{ fontSize: 15, marginBottom: 10 }}>
            Opponent: <span style={{ color: COLORS.primary, fontWeight: 600 }}>{opponent?.name || 'Waiting...'}</span> {opponent?.symbol && `(${opponent?.symbol})`}
          </div>
          {errorMsg && <div style={{ color: '#e53935', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>{errorMsg}</div>}
          <button
            className="ttt-btn"
            style={{
              background: COLORS.secondary,
              border: 'none',
              color: theme === 'light' ? '#fff' : '#eee',
              padding: '7px 20px',
              fontSize: 14, borderRadius: 8,
              fontWeight: 600,
              marginTop: 14,
              cursor: 'pointer'
            }}
            onClick={leaveGame}
          >
            &larr; Back
          </button>
        </section>
        {/* Side History panel for desktop */}
        <div className="ttt-game-sidebar-panel" style={{
          minWidth: 220,
          maxWidth: 280,
          display: window.innerWidth > 700 ? 'block' : 'none'
        }}>
          <PastGamesPanel/>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="App" style={{
      minHeight: '100vh',
      background: theme === 'light' ? '#f2f5fa' : COLORS.secondary,
      transition: 'background .3s'
    }}>
      <header className="ttt-navbar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        background: theme === 'light' ? '#fff' : COLORS.secondary,
        borderBottom: `1px solid ${COLORS.primary}12`,
        boxShadow: '0 1px 8px #0001'
      }}>
        <div style={{ fontWeight: 700, fontSize: 20, color: COLORS.primary }}>
          <span role="img" aria-label="tic-tac-toe">🎮</span> Tic Tac Toe
        </div>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          style={{
            background: COLORS.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '7px 17px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer'
          }}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>
      {/* Central content area */}
      <main style={{ padding: '0 8px', minHeight: 'calc(100vh - 60px)' }}>
        {!activeGame ? renderHome() : renderGame()}
      </main>
      <footer style={{
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        padding: '12px 4px 8px 4px'
      }}>
        Multiplayer Tic Tac Toe &mdash; React, powered by Kavia &mdash; {new Date().getFullYear()}
      </footer>
      <style>{`
        .ttt-btn:active { opacity:.95; transform: scale(.98);}
        @media (max-width: 700px) {
          .ttt-game-center {flex-direction:column;}
          .ttt-game-sidebar-panel {display:none !important;}
          .ttt-main-panel {margin:0 auto;}
        }
        .ttt-cell:focus {outline: 2px solid ${COLORS.primary};}
      `}</style>
    </div>
  );
}

export default App;
