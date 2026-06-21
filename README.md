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

## Docker / VPS

### Build e run local

```powershell
docker compose up --build -d
```

App em http://localhost:8080

### Deploy na VPS (Linux)

1. Clone o repositório na VPS:

```bash
git clone https://github.com/hbribeiro77/youtubeplaylist.git
cd youtubeplaylist
```

2. (Opcional) Crie um `.env` na raiz:

```bash
cp .env.example .env
# edite DEFAULT_PLAYLIST_ID se quiser playlist padrão
```

3. Suba o container:

```bash
docker compose up --build -d
```

4. Acesse `http://<IP-da-VPS>:8080`

O SQLite fica persistido no volume Docker `app-data`. Para expor na porta 80/443, use um reverse proxy (Nginx/Caddy) apontando para `localhost:8080`.

### Easypanel

No painel do app, configure:

| Campo | Valor |
|-------|-------|
| **Fonte** | GitHub → `hbribeiro77/youtubeplaylist` |
| **Build** | Dockerfile na raiz |
| **Porta interna** | `8080` (ou deixe o Easypanel injetar `PORT` — o app lê essa variável) |
| **Health check** | HTTP `GET /health` |
| **Domínio** | o subdomínio gerado (ex.: `apps-youtubeplaylist....easypanel.host`) |

Variáveis de ambiente opcionais:

```env
DEFAULT_PLAYLIST_ID=PLxxxx
DATABASE_URL=sqlite:///./data/youtubeplaylist.db
CORS_ORIGINS=*
```

Se aparecer **"Service is not reachable"**, confira nos logs do container se o uvicorn subiu e se a **porta do painel** bate com a variável `PORT` (padrão `8080`). Depois de alterar o repositório, faça **redeploy/rebuild** no Easypanel.

### Só com Docker (sem compose)

```bash
docker build -t youtubeplaylist .
docker run -d \
  --name youtubeplaylist \
  -p 8080:8080 \
  -v youtubeplaylist-data:/app/backend/data \
  -e DEFAULT_PLAYLIST_ID= \
  --restart unless-stopped \
  youtubeplaylist
```
