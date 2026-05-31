# Kindle Highlight Reminder Specification

## 概要

Kindle由来の読書メモをNotionデータベース `05_book` から取り込み、毎日ランダムに3冊を選び、各本から3つのハイライトを「過去の知恵」として表示・通知するPWA。

## 目的

- 過去に読んだ本のハイライトを日常的に再接触できるようにする。
- Notionに蓄積済みの読書メモを再利用する。
- スマホでも使える軽量なWebアプリとして提供する。

## 入力ソース

### Primary Source

- Notion database: `05_book`
- Database URL: `https://www.notion.so/2c4f58338f6580eebb3ed8a07a28b43d`
- Data source: `collection://fa1f5833-8f65-839b-bc45-076825675d6c`
- Primary view: `https://www.notion.so/2c4f58338f6580eebb3ed8a07a28b43d?v=ad4f58338f658386bae10830985309be`

### Notion Properties

- `名前`: 本のタイトル
- `作者`: 著者
- `タグ`: 分類タグ
- `URL`: 関連URL
- `作成日時`: 作成日時
- `更新されました`: 最終更新日時

### 同期方式

ブラウザアプリからCodexのNotion MCPを直接呼び出すことはできないため、Codex側でNotion MCPを使って `05_book` を取得し、結果を `data/notion-highlights.json` に保存する。

アプリは以下のどちらかでデータを取り込む。

- 起動時に `data/notion-highlights.json` を自動読み込み
- 画面の `MCP同期データを読み込む` ボタンで再読み込み
- `Notion MCP JSON` ファイル入力から手動インポート

## データ形式

```json
{
  "source": "notion:05_book",
  "exportedAt": "2026-05-31T15:16:00+09:00",
  "books": [
    {
      "id": "notion-page-id",
      "title": "Book title",
      "author": "Author",
      "tags": ["AI", "技術"],
      "url": "https://www.notion.so/...",
      "createdAt": "2026-05-22T02:43:12.483Z",
      "highlights": [
        "Highlight text"
      ]
    }
  ]
}
```

## 主要機能

### 1. ハイライト取り込み

- `data/notion-highlights.json` から本とハイライトを読み込む。
- JSON内の `books[*].highlights` を通知候補として扱う。
- 本のタイトル、著者、タグ、URL、作成日時をメタデータとして保持する。

### 2. 今日の3冊

- ハイライトを持つ本から日付をseedにして3冊を選ぶ。
- 選ばれた各本の中から、同じ日付seedで3つのハイライトを選ぶ。
- 同じ日は同じ `3冊 × 各3ハイライト` を表示する。
- `今日の3冊を再作成` ボタンで当日の選出結果を手動再抽選できる。
- 再作成後は、再作成時刻と提示中の冊数・ハイライト数を画面に表示する。
- 表示・通知に使うハイライト本文は、内容が伝わるよう最大100文字程度まで許容する。

### 3. ライブラリ表示

- 取り込んだ本の一覧を表示する。
- 各本にハイライト件数とタグを表示する。
- タイトル、著者、タグ、本文を対象に検索できる。

### 4. 通知

- ユーザーが通知時刻を指定できる。
- 通知許可が得られた端末で、指定時刻に今日の3冊と各3ハイライトを通知する。
- Service Workerが使える環境では `registration.showNotification` を使う。
- Service Workerが使えない環境では通常の `Notification` を使う。

## 通知の制約

現在の実装はPWA/ブラウザ側のローカル通知であり、サーバープッシュ通知ではない。

制約:

- ブラウザやOSの省電力制御により、完全な毎日定刻通知は保証されない。
- iOS/Androidで安定したバックグラウンド通知を行うには、Web Push対応とPush配信サーバーが必要。
- 現時点では「インストール済みPWAまたはブラウザ実行環境が保持している範囲で通知する」仕様。

## 画面構成

### Header

- アプリ名: `過去の知恵`
- 通知テストボタン

### 同期と設定

- `Notion MCP JSON` ファイル入力
- `MCP同期データを読み込む` ボタン
- `サンプルを読み込む` ボタン
- `保存データを書き出し` ボタン

### 通知設定

- 通知時刻
- 通知有効化チェックボックス

### サマリー

- ハイライト総数
- 本の冊数
- 同期状態

### 今日の3冊

- ランダム選出された3冊のカード
- 各カードに、その本から選ばれた3つのハイライトを表示
- 引き直しボタン

### ライブラリ

- 検索入力
- 本一覧

## 保存先

ブラウザ内の `localStorage` を使用する。

- `kindle-highlight-reminder:v1`: 本、ハイライト、今日の選出結果
- `kindle-highlight-reminder:settings`: 通知時刻、通知有効化状態
- `kindle-highlight-reminder:v1:today-key`: 今日の選出日付

## オフライン対応

Service Workerで主要ファイルをキャッシュする。

キャッシュ対象:

- `/`
- `index.html`
- `styles.css`
- `script.js?v=4`
- `manifest.webmanifest`
- `data/notion-highlights.json`

キャッシュ戦略:

- network-first
- ネットワーク失敗時にキャッシュを返す
- Service Worker更新時に古いキャッシュを削除する

## 現在の実装ファイル

- `index.html`: UI構造
- `styles.css`: レイアウトと見た目
- `script.js`: データ取り込み、抽選、検索、通知
- `sw.js`: Service Worker
- `manifest.webmanifest`: PWA manifest
- `data/notion-highlights.json`: Notion MCP同期結果
- `README.md`: 起動方法
- `notion-mcp-export-format.md`: JSON形式の詳細

## 非対応範囲

- ブラウザからNotion MCPを直接呼び出すこと
- Notion API tokenをブラウザに保存すること
- サーバーPush通知
- 複数端末間の同期
- ハイライトの編集・削除・タグ変更
- Notionへの書き戻し

## 将来拡張

- Node/Pythonの同期サーバーを追加し、Notion APIから定期同期する。
- Web Push配信サーバーを追加し、スマホへ安定した毎日通知を送る。
- ハイライト既読/お気に入り/非表示を管理する。
- タグ別・本別・テーマ別の通知フィルタを追加する。
- Notionページ本文からハイライトを自動抽出するCLIを追加する。
