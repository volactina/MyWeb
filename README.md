# Demo Website (Flask + CSV)

## Stack
- Backend: Python 3 + Flask
- Frontend: HTML + JavaScript
- Storage: `database.csv`

## Data Structure
- `id`
- `title` (name/title)
- `detail` (detail content)
- `created_at`
- `updated_at`

## Features
- CRUD: create / read / update / delete
- Filter query by:
  - title
  - detail

## Run
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask
python3 app.py
```

Then open: `http://127.0.0.1:5000`
