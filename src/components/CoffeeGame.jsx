import { useLayoutEffect, useEffect, useRef, useState } from 'react';

export default function CoffeeGame() {
    const canvasRef = useRef(null);
    let [flashActive, setFlashActive] = useState(false);
    let [paused, setPaused] = useState(false);
    let [muted, setMuted] = useState(() => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('coffeeRunMuted') === 'true';
      }
      return false; // In case localStorage is not available
    });

    const pausedRef = useRef(false);
    const jumpSoundRef = useRef(null);
    const madnessSoundRef = useRef(null);

    function togglePause() {
        setPaused (prev => {
            const next = !prev;
            pausedRef.current = next;

            //Resume loop if going off pause
            if (!next) {
                requestAnimationFrame(loopRef.current);
            }

            return next;
        });
    }

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
      if (typeof window !== 'undefined'){
        jumpSoundRef.current = new Audio('/assets/audio/coffeeRun/jump.wav');
        madnessSoundRef.current = new Audio('/assets/audio/coffeeRun/madness.wav');

        jumpSoundRef.current.volume = 0.5;
        madnessSoundRef.current.volume = 0.4;

        jumpSoundRef.current.muted = muted;
        madnessSoundRef.current.muted = muted;

        jumpSoundRef.current.onerror = () => console.warn('Jump sound failed to load or is unsupported.');
        madnessSoundRef.current.onerror = () => console.warn('Madness sound failed to load or is unsupported.');
      }
    })

    useEffect(() => {
      if (jumpSoundRef.current) jumpSoundRef.current.muted = muted;
      if (madnessSoundRef.current) madnessSoundRef.current.muted = muted;

      // Persist mute state to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('coffeeRunMuted', muted.toString());
      }
  }, [muted]);

    const loopRef = useRef(() => {});

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;

        if (!ctx) return;
        
        window.onerror = function (message, source, lineno, colno, error) {
            console.log('Error:', message, 'at', source + ':' + lineno + ':' + colno);
        }

        let groundY;

        // Load player sprite from assets folder
        const playerImg = new Image();
        playerImg.src = '/assets/sprites/coffeeRun/cuppy.png';

        const BASE_SCALE = Math.min(canvas.width / dpr, canvas.height / dpr) / 800;
        const SAFE_AREA_TOP = 32;

        let timeSinceLastSpawn = 0;
        const getSpawnInterval = () => {
          if (!reverseMode) return 1.5; //Standard interval
          const madnessProgress = Math.max(0, score - 30);
          return Math.max(0.4, 1.5 - madnessProgress * 0.01); //Decreases the spawn time while in coffee madness, hits 0.4 after enemy #140
        }

        let assetsToLoad = 8;
        let assetsLoaded = 0;

        let player;

        ctx.imageSmoothingEnabled = false;

        let fontSize;
        let gravity;
        let jumpVelocity;

        const updatePhysicsConstants = (height) => {
            gravity = height * 0.0015;
            jumpVelocity = height * 0.025;
        }

        const resizeCanvas = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
        
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr); 
        
            fontSize = Math.min(width, height) * 0.04;
        
            const MAX_PLAYER_WIDTH = 96;
            const MAX_PLAYER_HEIGHT = 96;

            const playerWidth = Math.min(width * 0.15, MAX_PLAYER_WIDTH);
            const aspectRatio = playerImg.height / playerImg.width || 1;
            const playerHeight = playerWidth * aspectRatio;

            player = {
                x: width * 0.1,
                y: height * 0.8,
                w: playerWidth,
                h: Math.min(playerHeight, MAX_PLAYER_HEIGHT),
                vy: 0,
                jumping: false,
            };
        
            groundY = height - player.h - 20;
        
            updatePhysicsConstants(window.innerHeight);
        };

        resizeCanvas();

        window.addEventListener('resize', resizeCanvas);

        let obstacles = [];
        let baseSpeed = 6;
        let speed = baseSpeed;
        let frame = 0;
        let score = 0;
        let gameOver = false;
        let reverseMode = false;

        // Load enemy sprites as array
        const enemyImgs = [];
        let loadedEnemies = 0;

        for (let i = 0; i <= 6; i++) {
            const img = new Image();
            img.src = `/assets/sprites/coffeeRun/enemy-${i}.png`;

            img.onload = tryStartGame;

            img.onerror = () => {
                console.error(`Failed to load image: enemy-${i}.png`);
                tryStartGame();
            }

            enemyImgs.push(img);
        }

        playerImg.onload = tryStartGame;

        playerImg.onerror = () => {
            console.error('Failed to load playerImg: cuppy.png')
            tryStartGame();
        }

        function startGame() {
            updatePhysicsConstants(window.innerHeight);
            resizeCanvas();
            requestAnimationFrame((ts) => {
                lastTimestamp = ts;
                loopRef.current(ts);
            });
        }

        function tryStartGame() {
            assetsLoaded++;
            if (assetsLoaded === assetsToLoad) {
                resizeCanvas();
                startGame();
            }
        }

        function jump() {
            if (pausedRef.current || gameOver || player.jumping) return;

            player.vy = -jumpVelocity;
            player.jumping = true;
            jumpSoundRef.current.currentTime = 0;
            jumpSoundRef.current.play().catch((e) => {
              console.warn('Jump sound playback failed:', e);
            });
        }

        function handleTouch(e) {

            // Check if the touch event originated from the pause button
            const isPauseButton = e.target.closest('[data-ui-element="pause-button"]');
            if (isPauseButton) return;

            if (gameOver) {
                window.location.reload();
            } else if (!pausedRef.current) {
                jump();
            }
        }

        window.addEventListener('touchstart', handleTouch);

        let lastTimestamp = null;

        loopRef.current = function loop (timestamp) {
            if (pausedRef.current || gameOver) return;

            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = (timestamp - lastTimestamp) / 1000
            lastTimestamp = timestamp;

            frame++;
            player.vy += gravity * deltaTime * 60;
            player.y += player.vy * deltaTime * 60;

            if (player.y > groundY) {
                player.y = groundY;
                player.vy = 0;
                player.jumping = false;
            }

            if (score === 20 && !reverseMode) {
                const offset = (canvas.width / dpr) * 0.05;

                reverseMode = true;
                player.x = canvas.width / dpr - player.w - offset;

                // Clear all enemies 
                obstacles = [];

                // Force enemy spawn
                timeSinceLastSpawn = 999;

                // We need to force the canvas to draw everything after the flip to ensure it happens before the flash disappears.
                ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                ctx.fillStyle = '#555';
                ctx.fillRect(0, groundY + player.h, canvas.width / dpr, 5);
                ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
                ctx.fillStyle = '#00f5d4';
                ctx.font = `${fontSize}px monospace`;
                ctx.fillText('Score: ' + score, 10, SAFE_AREA_TOP + fontSize);
            
                setFlashActive(true);
                setPaused(true);
                pausedRef.current = true
                madnessSoundRef.current.currentTime = 0;
                madnessSoundRef.current.play();
            
                setTimeout(() => {
                    setFlashActive(false);
                    setPaused(false);
                    pausedRef.current = false;
                    requestAnimationFrame(loopRef.current);
                }, 2000);
                return;
            }            

            timeSinceLastSpawn += deltaTime;
            const currentSpawnInterval = getSpawnInterval();
            if (timeSinceLastSpawn >= currentSpawnInterval) {
                timeSinceLastSpawn = 0;

                const randomEnemy = enemyImgs[Math.floor(Math.random() * enemyImgs.length)];
                const direction = reverseMode ? 1 : -1;
                const startX = reverseMode ? -48 : canvas.width / dpr;

                obstacles.push({
                    x: startX,
                    y: groundY + 25,
                    w: 48,
                    h: 48,
                    img: randomEnemy,
                    hitboxOffset: 10,
                    direction: direction
                });
            }

            obstacles.forEach((ob, i) => {
                const madnessSpeed = baseSpeed + (reverseMode ? (score - 30) * 0.2 : 0);
                ob.x += ob.direction * madnessSpeed * deltaTime * 60;

                const hitW = ob.w - (ob.hitboxOffset || 0);
                const hitH = ob.h - (ob.hitboxOffset || 0);

                if (
                    player.x < ob.x + hitW &&
                    player.x + player.w > ob.x &&
                    player.y < ob.y + hitH &&
                    player.y + player.h > ob.y
                ) {
                    gameOver = true;
                } 
                if (
                    (!reverseMode && ob.x + ob.w < 0) ||
                    (reverseMode && ob.x > canvas.width / dpr)
                ) {
                    obstacles.splice(i, 1);
                    score++;
                }
            });

            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            ctx.fillStyle = '#555';
            ctx.fillRect(0, groundY + player.h, canvas.width / dpr, 5);

            ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);

            obstacles.forEach(ob => {
                ctx.drawImage(ob.img, ob.x, ob.y, ob.w, ob.h);
            });

            ctx.fillStyle = '#00f5d4';
            ctx.font = `${fontSize}px monospace`;
            ctx.fillText('Score: ' + score, 10, SAFE_AREA_TOP + fontSize);

            if (gameOver) {
                const gameOverText = 'GAME OVER';
                const textWidth = ctx.measureText(gameOverText).width;
                ctx.fillStyle = '#fff';
                ctx.font = `${fontSize}px monospace`;
                ctx.fillText(gameOverText, (canvas.width / dpr - textWidth) / 2, canvas.height / dpr / 2);
            } else {
                requestAnimationFrame(loopRef.current);
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') jump();
            if (gameOver && e.code === 'Enter') window.location.reload();
        });

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('touchstart', handleTouch)
        }
    }, []);

    return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            backgroundColor: '#000',
            position: 'relative',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              background: '#333',
              display: 'block',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
      
          {/* Flash overlay for madness mode */}
          {flashActive && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#fff',
                color: '#000',
                fontSize: '28px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2,
                fontWeight: 'bold',
                fontFamily: 'monospace',
                animation: 'fadeOut 2s forwards',
              }}
            >
              Coffee Madness Activated!
            </div>
          )}
      
          {/* Pause overlay */}
          {paused && !flashActive && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#000000aa',
                color: '#fff',
                fontSize: '24px',
                fontFamily: 'monospace',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2,
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              <p>Game Paused</p>
      
              <button
                data-ui-element="pause-button"
                onClick={togglePause}
                style={{
                  background: '#00f5d4',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '20px',
                  fontFamily: 'monospace',
                }}
              >
                Resume
              </button>
      
              <button
                onClick={() => setMuted(prev => !prev)}
                style={{
                  background: 'transparent',
                  border: '2px solid white',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '20px',
                  fontFamily: 'monospace',
                }}
              >
                {muted ? 'Unmute 🔇' : 'Mute 🔊'}
              </button>
            </div>
          )}
      
          {/* Pause button (top right) */}
          <button
            data-ui-element="pause-button"
            onClick={togglePause}
            style={{
              position: 'absolute',
              top: 'env(safe-area-inset-top, 0)',
              right: '12px',
              zIndex: 3,
              fontSize: '28px',
              background: 'transparent',
              color: '#fff',
              border: 'none',
              fontFamily: 'monospace',
            }}
          >
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      );      
}