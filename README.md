# 男気録 — OTOKOGI LOG

男気じゃんけんの勝負を、グループごとに楽しく記録するWebアプリです。

## 構成

- GitHub: ソースコード管理とCI
- Vercel: React/Viteフロントエンドの自動公開
- Supabase: PostgreSQL、Edge Function、更新履歴

公開画面からDBへ直接アクセスせず、すべての読み書きを
`otokogi-api` Edge Functionへ集約します。共有キーはURLにだけ保持し、
DBにはSHA-256ハッシュのみ保存します。Supabaseの秘密鍵はEdge Function内で
のみ使用し、GitHubやVercelの公開コードには含めません。

## 主な機能

- 1グループにつき1つの専用共有URL
- グループ・メンバー管理
- 勝負内容、日付、参加者、男気を見せた人、おごった金額の記録
- グループ全体・メンバー別のおごった金額の累計表示
- おやつ・ドリンク・ごはん・大勝負によるポイント制
- 100ポイントを最終ラインとする10段階ランク
- ランク別イラスト、現在地、次のランクまでの進捗
- 内容・メンバー名・カテゴリによる履歴検索
- 30秒ごと・画面復帰時の自動同期
- このブラウザで開いた「参加中グループ」一覧
- 同時更新時の競合検出と自動再試行
- 更新ごとの監査ログ・復旧用スナップショット
- 旧GAS共有リンクの初回アクセス時Supabase移行
- スマートフォン対応

## 開発

```bash
npm install
npm run dev
```

## 検証

```bash
npm run lint
npm test
npm run build
```

## Supabase

DB定義は `supabase/migrations/`、Edge Functionは
`supabase/functions/otokogi-api/` にあります。

Edge Functionは共有URLのランダムキーを独自認証として検証するため
`verify_jwt = false` で公開します。テーブルはRLSを有効化し、
`anon` と `authenticated` には権限を付与しません。

## 旧GASからの移行

Supabase側に共有グループが見つからない場合に限り、旧GAS APIから同じ
共有キーのデータを取得し、Supabaseへ一度だけ登録します。既存利用者は
URLを変更する必要がありません。移行完了後はSupabaseから読み書きします。
