# Kindle Highlight Reminder

Notion の `05_book` データベースを入力ソースにして、読書メモを毎日ランダムに3つ表示・通知するPWAです。

## 使い方

1. Codex が Notion MCP で取得した `05_book` の同期結果を `data/notion-highlights.json` に保存します。
2. 画面の `MCP同期データを読み込む` を押します。初回起動時は保存データがなければ自動読み込みします。
3. 通知時刻を選び、通知を有効化します。

## Notion source

- Database: `05_book`
- Database URL: `https://www.notion.so/2c4f58338f6580eebb3ed8a07a28b43d`
- Data source: `collection://fa1f5833-8f65-839b-bc45-076825675d6c`
- Primary view: `https://www.notion.so/2c4f58338f6580eebb3ed8a07a28b43d?v=ad4f58338f658386bae10830985309be`

ブラウザアプリからCodexのMCPツールを直接呼ぶことはできないため、Codex側でMCP同期し、結果JSONをアプリが読む構成にしています。

## JSON format

See [notion-mcp-export-format.md](./notion-mcp-export-format.md).

## Local run

Static files onlyです。Service Workerと通知確認には `localhost` 配信が必要です。

```powershell
python -m http.server 5177
```

Then open `http://127.0.0.1:5177`.

## Public deploy

公開用リポジトリでは実Notion同期データ `data/notion-highlights.json` は `.gitignore` で除外します。
Vercelなどの公開環境では `data/notion-highlights.demo.json` を読み込み、デモデータで動作します。

GitHub/Vercel公開時に実データも公開したい場合だけ、`data/notion-highlights.json` の除外を外してください。
