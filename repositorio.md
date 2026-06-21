# Repositório — YouTube Playlist

## Remote

- URL: https://github.com/hbribeiro77/youtubeplaylist.git
- Branch principal: `main`

## Push (!push)

```powershell
cd D:\claude\defensoria\youtubeplaylist
git add -A
git status
git commit -m "mensagem do commit"
git push -u origin main
```

Se o repositório remoto estiver vazio e for o primeiro push:

```powershell
git init
git branch -M main
git remote add origin https://github.com/hbribeiro77/youtubeplaylist.git
git push -u origin main
```

## O que não commitar

- `.env` (chaves e config local)
- `backend/data/` (SQLite local)
- `node_modules/`, `frontend/dist/`

## Rodar localmente

```powershell
.\scripts\start-app.ps1
```

App em http://localhost:8080

## Persistência do banco (Easypanel)

Cada redeploy sem volume **apaga** o SQLite. No Easypanel:

1. App → **Storage** → **Add Volume**
2. Name: `app-data` | Mount path: `/app/backend/data`
3. Redeploy

`DATABASE_URL` padrão: `sqlite:///./data/youtubeplaylist.db`
