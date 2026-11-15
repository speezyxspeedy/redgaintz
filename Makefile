.PHONY: setup test run frontend

setup:
	python -m pip install -e ".[test]"
	npm install

test:
	python -m pytest -q
	npm test

run:
	python -m uvicorn pipeline.api:app --reload --port 8000

frontend:
	npm run dev
