# Notion MCP export format

This app imports JSON exported from the Notion MCP `05_book` database.

Expected shape:

```json
{
  "source": "notion:05_book",
  "exportedAt": "2026-05-31T00:00:00.000Z",
  "books": [
    {
      "id": "notion-page-id-or-url",
      "title": "Book title",
      "author": "Author",
      "tags": ["AI", "技術"],
      "url": "https://www.notion.so/...",
      "createdAt": "2026-05-14T23:54:25.666Z",
      "highlights": [
        "A highlight or reading memo line.",
        "Another highlight."
      ]
    }
  ]
}
```

Current Notion source discovered by MCP:

- Database: `05_book`
- Database URL: `https://www.notion.so/2c4f58338f6580eebb3ed8a07a28b43d`
- Data source: `collection://fa1f5833-8f65-839b-bc45-076825675d6c`
- Primary view: `https://www.notion.so/2c4f58338f6580eebb3ed8a07a28b43d?v=ad4f58338f658386bae10830985309be`
- Properties: `名前`, `作者`, `タグ`, `URL`, `作成日時`, `更新されました`

Export flow:

1. Query the `05_book` database view through Notion MCP.
2. Fetch each returned page.
3. Extract short text lines from the page content as `highlights`.
4. Save the result as JSON and import it from the app.

Notes:

- Browser JavaScript cannot directly call Codex MCP tools.
- True remote push notifications require a server-side push service. This PWA schedules local browser notifications while the app is installed/opened by the browser runtime.
