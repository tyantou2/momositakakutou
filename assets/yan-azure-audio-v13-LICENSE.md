# 蒼閃・一文字 v13 音声素材

採用元はユーザーが正式指定した `yan_azure_cutin_v12_A.mp4`。B案・C案は使用していない。カメラ、フリーズ、文字、青白いフラッシュ、音楽、文字ごとの効果音を維持し、最後の「字」の次フレーム（133/30＝4.433333秒）に一つの決め音だけを追加した。

## 新しく加えた決め音

Kenney **Impact Sounds** の `impactBell_heavy_002.ogg` と `impactPunch_heavy_003.ogg` を重ね、一発の短い打撃として編集したもの。低めのピッチ、鋭いアタックと短い余韻。電子発振器で音を生成していない。

- 配布元：https://kenney.nl/assets/impact-sounds
- 作者：Kenney (www.kenney.nl)
- ライセンス：Creative Commons Zero / CC0
- https://creativecommons.org/publicdomain/zero/1.0/
- 商用・非商用利用、加工、ゲームへの組み込みが可能。クレジット義務はないが、ここに記載する。
- 編集：冒頭の無音を除去、再生レート0.72／0.8で低く調整、0.22／0.24倍で重ね、尺末尾に2msのフェード。追加音の長さは0.266667秒。作品の総尺4.7秒は変更していない。

`yan-azure-den-v13.wav` は追加音だけを確認するためのファイル。ゲームではこれを別に鳴らさず、完成ミックスに焼き込んだ音声を一度だけ使用する。

## 維持したA案の音声

音楽は提供された正式A案の完成ミックスを維持。元の制作ファイルのA案音楽ステムは3秒以降が完全に無音となっており、フリーズ後は文字音・元からあるフラッシュ音と今回の決め音だけになる。

元の文字・カメラ・エネルギー効果音は提供元の素材記録による以下のMixkit素材の加工・合成。今回、これらの元素材そのものは追加配布していない。

- Cinematic whoosh deep impact (1143)
- Big cinematic impact (788)
- Strong punches to the body (2198)
- Quick knife slice cutting (2152)
- Electricity static power up (2600)
- Fast thunder impact (1279)

配布元：https://mixkit.co/free-sound-effects/impact/

Mixkit Sound Effects Free License：https://mixkit.co/license/modal/sfxFree/

利用規約：https://mixkit.co/terms/

動画・ゲーム等へ他の素材と組み込んだ完成物として使用する。元素材の単体再配布や素材集としての配布はしない。

## 保存物と再生

- `yan_azure_cutin_final_v13.mp4`：正式A案の映像を再エンコードせずコピー。1280×720、30fps、141フレーム、4.7秒。音声AAC 48kHzステレオ。
- `yan-azure-soundtrack-v13.m4a`：上記MP4から音声を無再エンコードで抽出したもの。AACストリームのハッシュは同一。
- `yan-azure-v35.json`：時刻・ハッシュ・ファイルサイズ・映像同一性の検査記録。

ゲームではMP4をmuted / playsinlineのまま表示し、抽出音声を既存のWeb Audioとマスター／効果音音量へ通す。元の完成ミックス全体を扱うため、動画内BGMも効果音音量に連動する。カットイン中は通常対戦曲と旧Five Armiesを重ねず、終了後に通常対戦曲を復帰する。
