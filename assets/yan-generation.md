# ゃんのゲーム用画像

方法：内蔵の画像生成ツール。提供された本人のキャラクター画像を参照して新規生成。元画像は変更せず、ゲームには生成画像を軽量化した透明WebPだけを追加。

- yan.webp：構え。640×853。
- yan-poses.webp：構え・ジャブ・フィニッシュの3姿勢。1536×512。
- WebP化は等比縮小と可逆圧縮。透明度は維持。

## 最終プロンプト：構え

Use case: stylized-concept / identity-preserve. Create a NEW polished transparent PNG full-body fighting-game character sprite based on the attached reference of the user's own caricature. Preserve recognizable face, black rectangular glasses, tousled straight black hair, cheek shape and friendly slightly cheeky confident smile. Keep navy sweatshirt, charcoal trousers and white sneakers. Transform the relaxed standing pose into a cool ready-to-fight boxing stance facing RIGHT in a clear three-quarter side view, feet planted at a single baseline, knees bent slightly, one fist extended slightly forward and the other guarding chest, compact dark boxing gloves with subtle cyan seams. Chibi proportions approximately 3 heads tall to harmonize with cute mascot fighters, high-quality clean 2D game illustration, bold clean dark outlines, cel shading with a little painterly polish. Entire character including hair and shoes inside frame with 8 percent transparent margins. One character only; no panels, no labels, no text, no watermark, no floor, no shadow and NO background. Do not add large glow or particles outside the silhouette; those are rendered in game. The likeness, glasses, navy casual outfit and white sneakers are essential.

## 最終プロンプト：パンチ

Use case identity-preserve. Game animation sprite sheet based EXACTLY on this provided original fighting sprite of a friendly young adult with black rectangular glasses, tousled black hair, navy sweatshirt, charcoal trousers, white sneakers, black compact boxing gloves with cyan seams. Preserve EXACT character identity, face, body proportions and clean polished cel-shaded 2D illustration style. Make a horizontal transparent sprite sheet with THREE EQUAL WIDTH CELLS in one row. Each cell contains ONE full-body animation pose, facing RIGHT in 3/4 view. Left cell: guarded neutral boxing stance. Middle cell: a crisp lead straight punch, front arm extended naturally forwards, bent knees, rear glove by chin. Right cell: a powerful finishing rear-hand cross punch, torso rotated, extended fist naturally aligned through shoulder, opposite glove guarding. Arms must be anatomically connected, no detached fists, no extra arms or hands. Same character scale in all three cells, both shoes in every cell, feet on the exact same ground baseline. Keep all poses isolated fully within their cell with generous transparent padding. No background, no ground, no shadow, no glows or energy trails, no labels, no borders, no text or lettering. The sheet is to animate punches, so the middle and right poses must have genuinely extended punching arms, not just the original guard pose.
