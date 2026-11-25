# The Polyeths — PET & HDPE

Game đi cảnh 2D, giải đố, **hợp tác 2 người chơi trên cùng một bàn phím**, chạy ngay trên trình duyệt.
Dựng theo tài liệu concept `Concept_Game_PET_HDPE.docx`: một map liên tục duy nhất (Khu A → E), hai nhân vật
PET (#1) và HDPE (#2) với năng lực khác nhau, và chỉ phối hợp mới thoát ra được.

- **Stack:** HTML + CSS + JavaScript thuần (Canvas 2D). Không framework, không bước build, không cần cài thư viện.
- **Đồ hoạ & âm thanh:** vẽ bằng code và tổng hợp bằng WebAudio, không dùng file ảnh hay âm thanh ngoài.
- **Test:** dùng trình chạy test có sẵn của Node (`node --test`). Hiện có 52 test, gồm một bài cho bot chơi hết màn.

---

## 1. Chạy game

**Cách 1 (nhanh nhất):** mở file `index.html` bằng Chrome, Edge hoặc Firefox (nhấp đúp là được).

**Cách 2 (qua máy chủ cục bộ, cần Node ≥ 18):**

```powershell
npm start
```

Sau đó mở <http://localhost:8080>. Máy chủ nằm ở `tools/serve.js`, không phụ thuộc gói nào.

Bấm **Enter** hoặc nút **Bắt đầu** để vào game.

## 2. Điều khiển

| | P1 — **PET** ♳1 | P2 — **HDPE** ♴2 |
|---|---|---|
| Di chuyển | `A` / `D` | `←` / `→` |
| Nhảy (giữ lâu để nhảy cao hơn) | `W` hoặc `Space` | `↑` |
| Thả xuống qua sàn lưới | `S` | `↓` |

| Phím chung | Tác dụng |
|---|---|
| `Enter` | Bắt đầu / chơi lại sau khi thắng |
| `P` hoặc `Esc` | Tạm dừng / tiếp tục |
| `H` | Mở bảng hướng dẫn (tạm dừng game) |
| `R` | Chơi lại từ đầu |
| `M` | Bật / tắt âm thanh |

Muốn đổi phím thì sửa `CONTROLS` trong `js/config.js` (dùng mã `KeyboardEvent.code`, ví dụ `KeyJ`, `Numpad0`).

## 3. Cách chơi

### Hai nhân vật

| | PET (#1) | HDPE (#2) |
|---|---|---|
| Đặc tính | Trong suốt: ánh sáng truyền qua | Dai, chịu va đập; đục |
| Tia sáng | Đi xuyên qua, tín hiệu không bị gián đoạn | **Bị chặn lại** (che mất tia) |
| Bể NaOH (xanh lục) | **Phải nhảy qua**, chạm vào là hỏng | **Chạy qua được**, nhưng không được dừng (quá 0,3 s) và tổng thời gian trong bể tối đa 1,6 s |
| Bể chất thải oxy hoá giả lập (tím) | Phải nhảy qua | Phải nhảy qua |
| Máy dập / máy ép | Bị dập là hỏng | **Chặn được**: máy tì lên đầu và dừng lại |
| Nhảy | Cao và xa hơn | Thấp hơn: không nhảy qua được bể NaOH 6 ô |

### Bản đồ (một map duy nhất)

1. **Khu A — Cổng vào:** làm quen với di chuyển, nhảy và sàn lưới.
2. **Khu B — Hành lang hoá chất:** gồm bể NaOH 5 ô, bể oxy hoá 3 ô, bể NaOH 6 ô và bể oxy hoá 4 ô.
3. **Khu C — Trung tâm thử nghiệm:** hành lang trung tâm ở dưới, hai phòng nằm cạnh nhau ở trên, lên bằng các sàn lưới.
   - **Phòng A (bên trái):** có ba rèm tia sáng. PET đi qua để lấy **Vật phẩm A** (thấu kính quang học).
   - **Phòng B (bên phải):** có dãy 5 máy dập đặt sát nhau và lệch pha. HDPE đi qua để lấy **Vật phẩm B** (khớp nối chịu lực).
   - Vật phẩm chỉ đúng chủ mới nhặt được. Có đủ A và B thì cửa sang Khu D mở; hai đèn khoá trên cửa cho biết đã có vật phẩm nào.
4. **Khu D — Phòng phối hợp cuối:**
   1. PET leo vào hốc trên cao, có rèm tia sáng chặn HDPE, rồi đứng lên **tấm cảm biến**.
   2. Tín hiệu bật **cầu ánh sáng** bắc qua hố oxy hoá rộng 9 ô, nhưng đồng thời **máy ép** bắt đầu hạ xuống chặn lối.
   3. HDPE chạy qua cầu và **đứng dưới máy ép** để chặn nó.
   4. Giữ đồng thời cả hai điều kiện trong 3 giây để thanh đồng bộ đầy.
   5. Thanh đầy thì cửa thoát mở, cầu được khoá cố định và máy ép nâng lên.
   - Nếu PET rời tấm cảm biến, cầu tắt ngay; ai đang đứng trên cầu sẽ rơi xuống. Nếu máy ép đã đóng kín, PET rời tấm để máy nâng lên rồi thử lại.
5. **Khu E — Cửa thoát:** cả hai cùng vào vùng EXIT là hoàn thành màn.

**Hồi sinh:** khi hỏng, nhân vật hồi sinh ở đèn checkpoint gần nhất mà nó đã đi qua (đèn chuyển xanh). Số lần hỏng
hiện trên HUD.
**Dây nối:** hai nhân vật không được cách nhau quá `LEASH` px (mặc định 1400), và camera tự thu nhỏ để thấy cả hai.
**Biển `!`:** đứng cạnh biển thì gợi ý hiện ở cuối màn hình.

## 4. Cấu trúc mã nguồn

```
index.html          Trang game, HUD, menu hướng dẫn, màn chiến thắng
css/style.css       Giao diện HUD / menu
js/config.js        ★ Mọi thông số: tốc độ, độ nhảy, giới hạn NaOH, máy dập, máy ép, phím...
js/level.js         ★ Bản đồ: dựng bằng hàm rect()/pool(), cộng với danh sách thực thể
js/engine.js        Logic thuần (vật lý, va chạm, luật chơi), không dùng DOM nên test được bằng Node
js/render.js        Vẽ Canvas: nhân vật, máy móc, chất lỏng, camera
js/audio.js         Hiệu ứng âm thanh WebAudio
js/main.js          Bàn phím, vòng lặp bước cố định 60 Hz, HUD, menu
tools/serve.js      Máy chủ tĩnh cho `npm start`
tests/              Test (node:test)
```

Các script nạp theo thứ tự `config → level → engine → render → audio → main` và dùng chung biến toàn cục `PE`.
Nhờ vậy chỉ cần mở file là chạy, không cần bundler.

## 5. Điều chỉnh game

| Muốn… | Sửa ở đâu |
|---|---|
| PET/HDPE chạy nhanh hơn, nhảy cao hơn | `CHARACTERS.PET/HDPE.speed`, `.jump` trong `js/config.js` |
| Nới giới hạn bể NaOH cho HDPE | `NAOH.maxExposure`, `NAOH.maxStill` |
| Máy dập nhanh hoặc chậm hơn | `STAMPER` (thời gian hạ, chờ, nâng) |
| Máy ép hạ chậm hơn (dễ hơn) | `PRESS.closeSpeed` |
| Thời gian giữ đồng bộ ở phòng cuối | `SYNC_TIME` |
| Cho hai người đi xa nhau hơn | `LEASH`, `MIN_ZOOM` |
| Dời, nới rộng bể hoặc phòng | `pool(cột, độ rộng, 'N' hoặc 'X')`, `rect(...)` trong `js/level.js` |
| Đổi lời gợi ý | `signs` trong `js/level.js` |
| Đổi màu | `COLORS` trong `js/render.js` |

Sau khi sửa, tải lại trang là thấy thay đổi. Nên chạy `npm test` để chắc màn chơi vẫn qua được, vì bài test chơi
trọn màn sẽ báo lỗi nếu, chẳng hạn, một bể bị nới rộng quá sức nhảy.

Gỡ lỗi trong console của trình duyệt: `__polyeths.state` là toàn bộ trạng thái game, còn
`__polyeths.step(60, {p1:{right:true}})` chạy ngay 60 bước mô phỏng.

## 6. Kiểm thử

```powershell
npm test
```

| File | Nội dung chính |
|---|---|
| `tests/level.test.js` | Bản đồ hợp lệ: kín tường; các khu A–E liền nhau; điểm xuất phát và checkpoint nằm trên sàn; vật phẩm đúng phòng; hố phòng cuối không ai nhảy qua được |
| `tests/physics.test.js` | Trọng lực, tường, tốc độ; PET nhảy cao hơn HDPE; nhảy ngắn khi thả phím; không nhảy hai lần; nhảy ngay khi vừa rời mép (coyote) và bấm nhảy sớm vẫn tính (jump buffer); sàn lưới (nhảy xuyên, thả xuống); dây nối |
| `tests/hazards.test.js` | PET chạm NaOH thì hỏng nhưng nhảy qua được; HDPE chạy qua an toàn, hỏng nếu dừng lại hoặc ở trong bể quá lâu, không nhảy qua được bể 6 ô; bể oxy hoá nguy hiểm cho cả hai; hồi sinh tại checkpoint |
| `tests/rooms.test.js` | PET đi xuyên tia sáng còn HDPE bị chặn (kể cả khi nhảy); vật phẩm chỉ đúng chủ nhặt được; HDPE chặn máy dập; PET không qua được dãy máy dập ở **mọi thời điểm xuất phát** và trong **300 lần đi/dừng ngẫu nhiên**; cửa cần đủ A và B |
| `tests/finale.test.js` | Chỉ PET bật được tấm cảm biến; cầu bật/tắt và rơi khi cầu tắt; máy ép tự đóng; HDPE chặn máy ép; thanh đồng bộ đầy hoặc tụt; cửa thoát mở; điều kiện thắng; không ai qua hố một mình |
| `tests/render.test.js` | Vẽ mọi khu bằng canvas giả không lỗi; camera thu nhỏ và không lộ ra ngoài biên |
| `tests/playthrough.test.js` | **Hai bot chỉ dùng phím ảo, chơi trọn màn từ Khu A tới Khu E mà không hỏng lần nào** |

## 7. Lưu ý khoa học

- PET thường trong suốt hơn HDPE, nhưng mức truyền sáng còn phụ thuộc cấu tạo, độ dày và loại vật liệu.
- HDPE thường dai và chịu va đập tốt, nhưng không có nghĩa là chịu được mọi lực hay mọi điều kiện.
- Tính kháng hoá chất không chỉ phụ thuộc tên polymer mà còn vào nồng độ, nhiệt độ, thời gian tiếp xúc và phụ gia.
- Các luật như "PET phải nhảy qua NaOH" hay "HDPE phải chạy nhanh" là cơ chế game đã đơn giản hoá, **không phải
  hướng dẫn thí nghiệm**. Bể oxy hoá là yếu tố giả lập, không đại diện cho hoá chất thật nào.
- **Không** thử nghiệm với NaOH hay chất oxy hoá thật để kiểm chứng game.
