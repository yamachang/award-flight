# Award Flight MCP Server

透過 [seats.aero](https://seats.aero) API 查詢里程票的 MCP Server，可搭配 Claude Code 使用。

## 前置需求

- Node.js >= 18
- [seats.aero Pro 帳號](https://seats.aero) （$10 USD/月，含 API 存取）
- 從 seats.aero 帳號設定取得 API Key

## 安裝

```bash
npm install
npm run build
```

## 設定 Claude Code

### 方法一：直接用 CLI 加入

```bash
claude mcp add award-flight node /path/to/award-flight/build/index.js -e SEATS_API_KEY=your_api_key
```

### 方法二：手動設定

編輯 `~/.claude/settings.json`：

```json
{
  "mcpServers": {
    "award-flight": {
      "command": "node",
      "args": ["/absolute/path/to/award-flight/build/index.js"],
      "env": {
        "SEATS_API_KEY": "your_api_key"
      }
    }
  }
}
```

## 提供的工具

### 1. `search_flights` — 查詢特定航線里程票

查詢特定機場對的里程票，跨所有里程計畫（Alaska, Aeroplan, United 等）。

```
用法範例（在 Claude Code 中直接用中文問）：
「幫我查 TPE 到 SDJ 12月商務艙里程票」
「查一下台北飛仙台 2026-12-01 到 2026-12-31 的商務艙」
```

### 2. `bulk_availability` — 查詢特定里程計畫的批量可用性

以特定里程計畫為基礎做大範圍搜尋。

```
用法範例：
「用 Alaska 里程看看亞洲有什麼商務艙票」
「查 Aeroplan 12月從亞洲出發的里程票」
```

### 3. `get_trips` — 查詢航班詳細資訊

從搜尋結果中取得特定航班的詳細資訊（航班號、時間、轉機等）。

## 支援的里程計畫 (Sources)

| Source | 里程計畫 | 聯盟 |
|--------|---------|------|
| alaska | Alaska Mileage Plan | Oneworld |
| aeroplan | Air Canada Aeroplan | Star Alliance |
| united | United MileagePlus | Star Alliance |
| american | American AAdvantage | Oneworld |
| delta | Delta SkyMiles | SkyTeam |
| emirates | Emirates Skywards | — |
| qatar | Qatar Avios | Oneworld |
| eurobonus | SAS EuroBonus | SkyTeam |
| virginatlantic | Virgin Atlantic | SkyTeam |
| flyingblue | Air France/KLM | SkyTeam |
| turkish | Turkish Miles&Smiles | Star Alliance |
| singapore | Singapore KrisFlyer | Star Alliance |
| etihad | Etihad Guest | — |
| qantas | Qantas Frequent Flyer | Oneworld |
| velocity | Velocity Frequent Flyer | — |

## 常見查詢技巧

- **想找最便宜的里程票**：用 `search_flights` 查特定航線，會列出所有計畫的價格比較
- **想找特定計畫**：用 `bulk_availability` 指定 source
- **台灣飛日本推薦查**：Alaska（星宇執飛超甜價）、Aeroplan（長榮執飛）、United（長榮執飛但較貴）
