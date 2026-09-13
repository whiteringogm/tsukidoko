# tsukidoko / 月どこ

現在地・現在時刻・スマートフォンの向きから、今いる場所の月を探すPWA。iPhone / Safariを優先した静的サイト。サーバーや外部APIなしで計算する。

## 使い方

1. HTTPSのURLをSafariで直接開く。
2. 「現在地を使う」を押して位置情報を許可する。
3. 「方角を使う」を押し、モーションと方向へのアクセスを許可する。
4. iPhoneでは一度画面を上にして水平に持ち、方位を合わせる。
5. 画面を自分に向け、背面カメラを空へかざす。矢印に従い、中央で「🌕 この先」となった方向を見る。

月が地平線の下ならその表示を優先する。センサー非対応・拒否・精度不足でも月の方位・高度・月相を表示。PCでも位置を許可すれば確認可能。横画面の方向案内は停止し、縦に戻すよう案内する。

Safariの共有メニュー →「ホーム画面に追加」でインストール。一度オンラインで正常に読み込み「オフライン起動の準備ができた」と表示された後は、基本画面・天文計算・磁気偏角補正をオフラインで利用できる。端末の位置取得自体がオフラインで成功するかはOSに依存する。

## 実装

- `dist/` が配信対象。HTML/CSS/ES Modules、ビルド・インストール不要。
- SunCalc **1.9.0**を同梱。南基準の方位角を真北基準・時計回りへ変換。大気差を含む高度を採用。月相と照明率を表示し、不正確な「月齢」換算はしない。
- geomagnetism **0.2.0 / WMM2025**を同梱し、iOSの磁北を真北へ補正。モデルの有効期間外・磁場の水平成分が2000 nT未満ならiOS方向案内を停止。
- Safariの`webkitCompassHeading`と相対`alpha`は、水平時にオフセットを合わせる。W3CのZ-X′-Y″回転行列で背面カメラ方向と月のベクトルを比較。垂直を跨いでも向きを反転させない。回転後のベクトルを平滑化。
- 標準APIでは`absolute === true`だけを北基準として利用。相対alpha単独をコンパスと誤認しない。
- `requestPermission(true)`はクリック内から直接実行。非対応・拒否・例外・イベント未着・4秒以上の更新停止を分けて扱う。Safariとホーム画面起動は許可が別になる場合を想定。
- 位置は端末のlocalStorageにのみ保存。24時間で無効。保存した位置を使う場合は取得時刻とともに明示。「保存した位置を消す」で削除・追跡停止。
- 月情報は15秒間隔。バックグラウンド中は案内更新を停止し、復帰時に方位をリセットして再校正。
- Service workerはバージョン単位のキャッシュを使用。更新時は`sw.js`のCACHE名を変更。古い画面が閉じてから新版を有効化し、HTMLとモジュールの混在を防ぐ。
- 位置座標を返さず現在表示中の月情報だけを読む任意のWebMCP機能あり。非対応ブラウザーでは無効。

## 開発・配信

Node.js 22以上で `node scripts/serve.mjs`。`http://127.0.0.1:4173`で表示。検証は `node --test` と `node scripts/check.mjs`。localhostは開発用にセンサーAPIが許可されるが、iPhoneからLANのHTTPへアクセスしても代用できない。

`dist/` をHTTPS対応ホストに配信。相対パスのため `/tsukidoko/` などのサブディレクトリでも利用可能。GitHub Pages用の手動実行ワークフローを同梱。GitHubの Settings → Pages → Source を GitHub Actions に設定し、Actionsの Deploy GitHub Pages を実行する。

## 検証状況と実機受け入れ手順

数値計算・方向の符号・北の0/360度境界・背面・天頂・キャッシュ・権限失敗を自動検証。**iPhone実機は未検証。実際の月へ正しく追従するという完成条件は、下記実機確認が済むまで未達。** ブラウザーの見た目の自動検査と実WebMCP対応環境での確認も未実施。

- [ ] Safariで位置と方角を初回許可し、水平校正後、東西南北と上下で矢印が追従する。
- [ ] 既知の月の位置で「この先」が実際の月と約10度以内に合う。高度0〜90度、端末の傾斜・ロールも確認する。
- [ ] 月が地平線の下の時刻に優先表示を確認する。
- [ ] 位置拒否、センサー拒否、位置取得タイムアウト、磁石付近、縦横回転、Safari復帰で誤案内しない。
- [ ] ホーム画面に追加し、単独起動でも許可と校正から使える。
- [ ] 一度読み込み後、機内モードでアプリを終了・再起動し、保存位置の明示と月情報更新を確認する。
- [ ] サービスワーカー更新後、アプリを閉じて再起動して新版に切り替わる。

コンパス・月位置計算は探索の目安。周囲の地形・建物・雲・月の視認性は判定しない。精密観測用途ではない。

## 調査した一次資料

- [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/) — 座標系・回転行列・絶対方位・ユーザー操作による許可。
- [Apple webkitCompassAccuracy](https://developer.apple.com/documentation/webkitjs/deviceorientationevent/1804769-webkitcompassaccuracy) — 磁北、精度の単位、未校正の負値。
- [WebKit Safari 13の許可](https://bugs.webkit.org/show_bug.cgi?id=201676) — ユーザー操作が必要。
- [WebKit iframeの制約](https://bugs.webkit.org/show_bug.cgi?id=221399) — Safariで直接開く設計。
- [SunCalc](https://github.com/mourner/suncalc/tree/v1.9.0) — 月の位置と月相。
- [geomagnetism](https://github.com/naturalatlas/geomagnetism/releases/tag/v0.2.0)、[NOAA WMM](https://www.ncei.noaa.gov/products/world-magnetic-model) — 磁気偏角補正。

同梱ライブラリのMITライセンスは `dist/vendor/` に保存。
