# E2EE年賀状 — 実装TODOリスト

## 0. 開発環境/品質基盤
- [x] Vite + React + TypeScript プロジェクト初期化（`vite@latest` react-ts テンプレ）
- [x] Tailwind CSS 設定（`postcss`/`tailwind.config.cjs`、`src/index.css`にベース/プリフライト）
- [x] shadcn/ui セットアップ（手動導入: components.json, cn util, button/input/card/textarea/badge）
- [ ] ESLint + Prettier + TypeScript eslint recommended ルール整備、CI 用 lint スクリプト追加
- [ ] Vitest + Testing Library 導入、`src/setupTests.ts`整備
- [x] PATH/alias 設定（`@/` プレフィックス）と型解決

## 1. ドメインモデル/永続化
- [ ] 型定義: `ContactKey`, `PostcardDraft`, `AppSettings`, `ChecksumBlock`
- [ ] IndexedDB ラッパー（idb）でストア作成：`contacts`, `drafts`, `settings`
- [ ] CRUD ヘルパー（保存/取得/削除、Fingerprint 主キーで重複排除）
- [ ] Zustand ストア設計（UI 状態と永続データ読み書き）＋ React Query 連携（KeyServer キャッシュ）

## 2. 公開鍵取得/管理
- [x] Armored 公開鍵インポート（テキスト貼付／.asc ファイル読み込み）※現状はテキスト貼付のみ
- [ ] Fingerprint 抽出（OpenPGP.js）とバリデーション
- [x] KeyServer 検索 UI（VKS: `keys.openpgp.org` の email/fingerprint/keyid）＋ 取得鍵を取り込み
- [ ] KeyServer 検索 UI（HKP/WKD の name 検索/複数結果一覧）＋ CORS/互換性の整理
- [ ] ラベル編集・削除 UI、作成日時表示
- [ ] オフライン対応: ローカル保存のみで動作する旨のメッセージ

## 3. 年賀状作成フロー
- [x] 平文入力フォーム（マルチライン）
- [x] 宛先複数選択 → 宛先ごとに個別暗号化（OpenPGP.js）
- [x] 暗号結果を ASCII armor 取得（.asc保存/コピー）
- [x] 長文分割ロジック：行単位で armor を複数ページに分割（暫定: 32行/ページ）
- [x] 印刷/OCR向けに armored を再wrap（暫定: 48 chars/line）
- [x] チェックサム生成（デフォルト 256 文字/ブロック、Web Crypto SHA-256 → Base32 4桁）
- [x] `PostcardDraft` 保存（平文/暗号文/ページ/チェックサム/宛先指紋）
- [ ] エラー/例外ハンドリング（サイズ超過/鍵不正/暗号化失敗時の詳細ガイドなど）

## 4. レイアウト・出力
- [x] Satori ではがきテンプレート JSX を実装（宛先 Fingerprint、差出人 Fingerprint、チェックサム、PAGE 表示）
- [x] 複数ページの SVG 生成（1 ページ 1 SVG）プレビュー UI + SVG保存
- [x] pdf-lib で SVG→PNG→PDF 生成（148x100mm 横向きページ、ページ結合）＋ ダウンロードボタン（暫定）
- [ ] 印刷ガイド（用紙サイズ/余白固定の注意書き）とテスト印刷用モード

## 5. OCR 復号支援
- [x] 入力手段: 画像アップロード（PNG/JPEG）+ テキスト貼り付け（カメラは未対応）
- [x] PDFアップロード（pdf.jsでページを画像化→OCR、最大20ページ）
- [ ] PGP ブロック領域検出（簡易: テキスト全体からヘッダ/フッタ抽出 → 将来拡張に備え関数分離）
- [x] Tesseract.js で OCR 実行、正規化（base64部の空白除去 + 再wrap）
- [x] チェックサム再計算し、ブロックごとの一致/不一致を表示
- [x] 誤読しやすい文字をハイライト（0/O, 1/I/l, S/5, B/8 等）
- [x] 手動編集エディタ（テキストエリア）と再チェック
- [x] 全チェックサム一致時に復号コマンド表示 + クリップボードコピー + message.asc保存

## 6. UI/UX 全体
- [x] ナビゲーション設計（鍵管理 / 作成 / はがき出力 / 復号支援）
- [ ] トースト/モーダルによるフィードバック（保存成功・暗号化エラー・OCR進行状況）
- [ ] ローディング/進捗表示（KeyServer検索、暗号化、OCR）
- [ ] アクセシビリティ（キーボード操作・ARIA・適切なコントラスト）
- [ ] 多言語対応の準備（文言を定数化、日本語デフォルト）

## 7. 設定
- [ ] KeyServer URL 変更 UI（デフォルト HKP）
- [ ] チェックサムブロックサイズ設定
- [ ] テンプレート ID（将来拡張用）保持のみ

## 8. セキュリティ/非機能
- [ ] 秘密鍵を扱わないことを UI/ドキュメントで明示
- [ ] 依存ライブラリバージョン固定、sri/lockfile 管理
- [ ] CSP/iframe 等のヘッダ設定（可能な範囲で Vite 設定）
- [ ] オフライン動作確認（KeyServer 検索以外）
- [ ] 外部トラッキング・ログ送信なしの確認

## 9. テスト
- [ ] 単体: チェックサム生成/検証、分割ロジック、Fingerprint 抽出、暗号化処理（モック鍵）
- [ ] コンポーネント: 主要フォーム・プレビューのスナップショット/振る舞いテスト
- [ ] E2E（Playwright 等）: ①鍵登録→暗号化→PDF出力、②OCR→手動修正→コマンド生成
- [ ] パフォーマンステスト: 長文入力時の分割/レンダリング時間測定

## 10. デプロイ/配布
- [ ] `npm run build` で静的出力生成
- [ ] GitHub Pages/静的ホスティング用設定（`base`、アセットパス確認）
- [ ] README にセットアップ/使用手順/制約を記載

## 11. スコープ外（MVPでやらない）
- ブラウザ内復号（秘密鍵扱い）
- 年賀状デザインエディタ/カスタムテンプレ
- QR/バーコード併用モード
- 高度な画像前処理（opencv.js）※必要になれば再検討
