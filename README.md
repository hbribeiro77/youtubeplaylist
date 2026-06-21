# YouTube Playlist

PWA mobile-first para assistir playlists do YouTube com busca em título, descrição, tags e transcrição — **sem API key do Google**.

## Stack

- **Backend:** FastAPI + SQLite + FTS5 + yt-dlp
- **Frontend:** React + Vite + Tailwind (servido pelo próprio FastAPI)
- **Testes:** pytest, Vitest, Playwright

## Início rápido (um comando)

```powershell
.\scripts\start-app.ps1
```

Abre em **http://localhost:8080** — frontend e API no mesmo processo.

## Configuração opcional

Copie `.env.example` para `.env`:

```powershell
Copy-Item .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `DEFAULT_PLAYLIST_ID` | Playlist que abre automaticamente na home |
| `PORT` | Porta do servidor (padrão: 8080) |
| `DATABASE_URL` | Caminho do SQLite |

**Não precisa de `YOUTUBE_API_KEY`.** Os metadados da playlist vêm via [yt-dlp](https://github.com/yt-dlp/yt-dlp).

## Uso

1. Acesse http://localhost:8080
2. Cole a URL de uma playlist pública (`youtube.com/playlist?list=...`)
3. Aguarde a sincronização e assista

No celular (mesma rede Wi-Fi): `http://<IP-do-PC>:8080`

## API

- `GET /health`
- `GET /playlists`
- `POST /playlists` — `{ "url_or_id": "..." }`
- `GET /playlists/{id}/videos?q=`
- `POST /playlists/{id}/sync`

## Testes

```powershell
.\scripts\run-all-tests.ps1
.\scripts\run-smoke-tests.ps1
```

## Docker

```powershell
docker compose up --build
```

Serviço único em http://localhost:8080
