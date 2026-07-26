# HƯỚNG DẪN THUYẾT TRÌNH ASM — BUBBLE BATTLE

## 1. Tổng quan bài toán
Game **Bubble Battle: Campus Chaos** là một game 2D đối kháng hai người chơi cục bộ (Local 2-Player) trên cùng một bàn phím. Mục tiêu của mỗi người chơi là đặt bóng nước thông minh để bẫy và hạ gục đối thủ trong bản đồ dạng lưới.

---

## 2. Vì sao chọn Phaser 3 Engine?
- **Hiệu năng cao:** Phaser 3 tối ưu hóa WebGL/Canvas rendering trên trình duyệt.
- **Arcade Physics:** Hệ thống vật lý Arcade AABB nhẹ, phù hợp hoàn hảo cho game lưới 2D tile-based.
- **Quản lý Scene:** Cung cấp sẵn cơ chế Scene Flow (Boot -> Menu -> Game -> Result) rõ ràng và dễ bảo trì.

---

## 3. Kiến trúc Luồng Scene (Scene Flow)
1. **BootScene:** Khởi tạo texture placeholder (Player 1, Player 2, Balloon) an toàn, tránh trùng lặp.
2. **MenuScene:** Hướng dẫn phím bấm, hiển thị giao diện bắt đầu.
3. **GameScene:** Vòng lặp gameplay chính, quản lý bản đồ, người chơi, bóng nước, va chạm và HUD.
4. **ResultScene:** Hiển thị kết quả thắng/thua/hòa kèm lý do và thời gian thi đấu, cho phép nhấn Space để chơi lại.

---

## 4. Biểu diễn bản đồ bằng Ma trận 2D
Bản đồ được biểu diễn dạng mảng hai chiều 11 rows x 15 columns (`LEVEL_01` trong `src/data/level01.js`):
- `0` (`TILE.FLOOR`): Ô sàn di chuyển tự do.
- `1` (`TILE.WALL`): Tường cứng không thể phá hủy.
- `2` (`TILE.CRATE`): Thùng gỗ có thể bị phá hủy bởi nước nổ.

---

## 4.5. Tính năng Giáo dục — JavaScript Quiz System

### Ý nghĩa giáo dục
Tính năng Quiz System kết hợp kiến thức JavaScript vào gameplay một cách tự nhiên. Sau khi phá thùng gỗ, người chơi có cơ hội gặp câu hỏi JavaScript. Trả lời đúng không chỉ giúp ghi nhớ kiến thức mà còn nhận power-up giúp tăng lợi thế trong trận đấu. Điều này tạo động lực học tập thông qua phần thưởng trong game.

### Cách kết hợp vào gameplay
1. **Quiz Item** (dấu `?` vàng) xuất hiện tại vị trí thùng gỗ vừa bị phá.
2. Khi người chơi chạm vào, GameScene tạm dừng, mở QuizScene overlay.
3. P1 chọn đáp án bằng phím `1`-`4`, P2 chọn bằng Arrow Up/Down + Enter.
4. Đồng hồ 10 giây đếm ngược.
5. Trả lời đúng: nhận power-up (Speed Boost 15s, Extra Balloon cap 5, Explosion Range cap 5).
6. Game tiếp tục sau khi đóng QuizScene.

### Kỹ thuật JavaScript nâng cao được áp dụng
- **ES Modules:** `JS_QUESTIONS` export từ `src/data/jsQuestions.js`, quiz utils từ `src/utils/quiz.js`.
- **Pure Functions:** `selectRandomQuestion()`, `isCorrectAnswer()`, `validateQuestionBank()` không có side effect, dễ kiểm thử.
- **Event-driven architecture:** Events `crate_destroyed`, `quiz_answered`, `power_up_granted` giữ các module decoupled.
- **Timers:** Quiz countdown (10s), speed boost expiry (15s), notification auto-hide (2s), item lifetime (20s).
- **State management:** `ROUND_STATE.PAUSED` khi quiz mở, ngăn input và physics trong lúc trả lời.
- **Array methods:** `Set` cho hidden crates, `Map` cho quiz items, `Array.filter` cho eligible crates.
- **Classes:** `QuizItem extends Phaser.GameObjects.Container`, `QuizScene extends Phaser.Scene`.
- **Race condition prevention:** Handler tập trung `handleQuizItemOverlap` kiểm tra `activeQuizSession` trước khi claim.
- **UI safety:** Adaptive font sizing, wordWrap, result overlay, bounds checking cho mọi text object.
- **Input isolation:** P1 dùng `1`–`4`, P2 dùng Arrow/Enter, hai bộ input không ảnh hưởng lẫn nhau.
- **Power-up balance:** Speed +20% × 15s, Balloon cap 5, Range cap 5, không stack multiplier.
- **Centralized constants:** `POWER_UP_RULES` và `QUIZ_DROP_RULES` quản lý toàn bộ tham số gameplay.

---

## 5. Chuyển đổi Tọa độ Grid <-> World
Sử dụng 2 hàm thuần (Pure Functions) trong `src/utils/grid.js`:
- `gridToWorld(row, col, tileSize)`: Tính tâm tọa độ pixels `(x, y)` từ ô lưới.
- `worldToGrid(x, y, tileSize)`: Quy đổi vị trí pixels `(x, y)` của entity về ô lưới `(row, col)`.

---

## 6. Cơ chế Hoạt động của Bóng Nước (WaterBalloon)
- Khi nhận sự kiện `request_place_balloon`, `GameScene` kiểm tra ô lưới trống và giới hạn bóng của người chơi.
- Bóng nước tạo ra thuộc `physics.add.staticGroup()`, cài đặt fuse timer (`balloonFuseDuration = 2000ms`).
- **Owner Pass-through Logic:** Người vừa đặt bóng được phép đi xuyên qua bóng. Ngay khi bước ra khỏi vùng phủ của bóng (`physics.overlap == false`), ID của họ bị xóa khỏi `passThroughPlayerIds`, khiến bóng trở thành vật cản cứng.

---

## 7. Thuật toán Nổ Lan 4 Hướng (ExplosionSystem)
Khi bóng nổ, `ExplosionSystem` phát tán tia nước theo 4 hướng (`UP`, `DOWN`, `LEFT`, `RIGHT`) dựa theo độ dài `range`:
- Duyệt từng ô theo hướng:
  - Nếu gặp `WALL`: Dừng ngay lập tức.
  - Nếu gặp `CRATE`: Tạo tia nổ tại ô thùng, xóa thùng khỏi ma trận (`mapSystem.removeCrate`), sau đó dừng.
  - Nếu là `FLOOR`: Tạo tia nổ và tiếp tục lan rộng.

---

## 8. Vòng đời Trạng thái Người chơi (ACTIVE -> TRAPPED -> DEAD)
1. **ACTIVE:** Người chơi di chuyển và đặt bóng bình thường.
2. **TRAPPED:** Khi trúng tia nước nổ, người chơi đổi màu cyan, không thể di chuyển và kích hoạt `trapTimer` (3000ms). Khi đã TRAPPED, hit tiếp theo không khiến người chơi chết ngay.
3. **DEAD:** Khi `trapTimer` hết hạn, người chơi chuyển sang `DEAD`, ẩn sprite, vô hiệu hóa physics body và phát sự kiện `player_dead`.

---

## 9. Phân định Thắng / Thua / Hòa (Round Manager & Pure Resolver)
`RoundManager.resolveRound()` gọi hàm thuần `resolvePlayerStates(p1State, p2State, isTimeout)` trong `src/utils/roundResolver.js`:
- `DEAD` + `ACTIVE` -> Player 2 thắng.
- `ACTIVE` + `DEAD` -> Player 1 thắng.
- `DEAD` + `TRAPPED` / `TRAPPED` + `DEAD` -> Hòa (Draw) vì người chơi TRAPPED chắc chắn sẽ chuyển sang DEAD.
- `DEAD` + `DEAD` -> Hòa.
- Hết giờ (`isTimeout = true`) khi cả 2 còn sống -> Hòa.

---

## 10. Các Lỗi Quan Trọng Đã Sửa trong Quá trình QA
1. **Fix RefreshBody Static Body:** Chuyển từ `refreshBody()` sang `balloon.body.updateFromGameObject()` để tương thích Arcade Static Physics.
2. **Fix Touch Pass Through:** Chuyển thuật toán kiểm tra thoát bóng từ AABB thủ công sang `scene.physics.overlap()`, xử lý triệt để bug kẹt người chơi.
3. **Fix Reset Listener Leak:** Đăng ký event handler `SHUTDOWN` trên `GameScene` để hủy toàn bộ event listener khi chuyển Scene.
4. **Fix Round Winner Resolution:** Sửa logic phân định để không bao giờ tuyên bố người chơi đang ở trạng thái `TRAPPED` thắng trận.

---

## 11. Chiến lược Kiểm thử Tự động (Vitest & Playwright)
- **Vitest Unit Tests:** Kiểm tra các trường hợp tổ hợp trạng thái kết thúc trận đấu trong `roundResolver.test.js`.
- **Playwright Browser Integration Tests:** Script `verify-browser.js` tự động khởi chạy Chrome headless, mô phỏng phím bấm, kiểm tra di chuyển, va chạm vật lý, nổ bóng và chạy lặp 3 chu kỳ restart scene để đảm bảo 0 rò rỉ bộ nhớ hay duplicated listeners.

---

## 12. Kịch bản Demo 2-3 Phút
1. **0:00 - 0:30:** Mở game (`npm run dev`), giới thiệu MenuScene và bảng hướng dẫn phím bấm cho P1 (1-4) và P2 (Arrow + Enter).
2. **0:30 - 1:15:** Nhấn Space vào trận. Di chuyển P1 (WASD) và P2 (Phím mũi tên), phá hủy thùng gỗ (`CRATE`) để mở đường. Demo Quiz Item xuất hiện, nhặt và trả lời câu hỏi JS, nhận power-up.
3. **1:15 - 2:00:** Đặt bóng nước (`SPACE` / `ENTER`), demo tính năng đi xuyên qua bóng lúc vừa đặt và bị chặn lại khi quay lại.
4. **2:00 - 2:30:** Bẫy đối thủ vào nước (`TRAPPED`), chờ đếm ngược biến thành `DEAD` và chuyển sang `ResultScene` hiển thị màn hình chiến thắng.
5. **2:30 - 3:00:** Nhấn `SPACE` để Restart trận mới tức thì.

---

## 14. Top 10 Câu Hỏi Thường Gặp Của Giảng Viên & Câu Trả Lời
1. **Q: Tại sao em lại chọn Phaser 3 Arcade Physics thay vì Matter.js?**
   *A:* Arcade Physics rất nhẹ, dùng AABB collision phù hợp tuyệt đối cho dạng game xếp lưới 2D như Bomberman/Bubble Battle, giúp kiểm soát va chạm chính xác từng pixel mà không bị giật lag hay xoay góc không mong muốn.
2. **Q: Ma trận bản đồ được lưu trữ và truy cập như thế nào?**
   *A:* Lưu dưới dạng mảng 2 chiều 11x15 các số nguyên đại diện cho Enum `TILE.FLOOR (0)`, `TILE.WALL (1)`, `TILE.CRATE (2)`. Đọc và cập nhật qua các hàm `getTileAt()` và `removeCrate()`.
3. **Q: Làm sao để người chơi không bị kẹt khi vừa đặt bóng nước dưới chân?**
   *A:* Mỗi quả bóng khi khởi tạo sẽ lưu `passThroughPlayerIds = Set([owner.id])`. Trong mỗi frame update, game kiểm tra `scene.physics.overlap()`. Khi người chơi bước hẳn ra ngoài bóng, ID của họ bị xóa khỏi Set, bóng trở thành vật cản cứng.
4. **Q: Tia nước nổ 4 hướng được xử lý ra sao để không nổ xuyên tường?**
   *A:* `ExplosionSystem` duyệt vòng lặp `for` từ 1 đến `range` theo 4 hướng vector. Nếu gặp `TILE.WALL` thì ngắt `break` ngay lập tức; nếu gặp `TILE.CRATE` thì nổ thùng và `break`.
5. **Q: Tại sao lại có trạng thái trung gian TRAPPED trước khi DEAD?**
   *A:* Đây là đặc trưng gameplay bóng nước: khi dính nước người chơi bị bóng bao bọc (bóng bóng bóng), đếm ngược 3 giây trước khi vỡ (DEAD).
6. **Q: Trường hợp một người DEAD và người kia đang TRAPPED thì ai thắng?**
   *A:* Kết quả là **Hòa (Draw)** vì người ở trạng thái TRAPPED chắc chắn sẽ chuyển sang DEAD do không có cơ chế giải cứu. Hàm thuần `resolvePlayerStates()` kiểm tra chính xác trường hợp này.
7. **Q: Làm thế nào em đảm bảo không bị trùng lặp Event Listeners khi người chơi Restart nhiều lần?**
   *A:* Trong `GameScene.create()`, em đăng ký lắng nghe sự kiện `Phaser.Scenes.Events.SHUTDOWN` để tự động tháo bỏ (`off()`) toàn bộ sự kiện `request_place_balloon`, `balloon_explode` và hủy các timer.
8. **Q: Tại sao dự án lại dùng cả Vitest và Playwright?**
   *A:* Vitest dùng để unit test nhanh các hàm thuật toán thuần (Pure Functions) như `resolvePlayerStates`. Playwright dùng để integration test thực tế trên trình duyệt thật (Headless Chrome) đảm bảo UI, Canvas và Physics hoạt động chuẩn.
9. **Q: Responsive Canvas được cấu hình như thế nào để không bị vỡ giao diện trên các màn hình khác nhau?**
   *A:* Em sử dụng Phaser Scale Manager với `mode: Phaser.Scale.FIT` và `autoCenter: Phaser.Scale.CENTER_BOTH`. Canvas tự động co giãn vừa màn hình nhưng vẫn giữ nguyên tỷ lệ 800x600 và hệ tọa độ logic bên trong.
10. **Q: Các kỹ thuật JavaScript nâng cao nổi bật được áp dụng trong dự án là gì?**
    *A:* Dự án áp dụng OOP ES6 Classes, ES Modules (import/export), Pure Functions cho logic kiểm thử, Event Emitters cho giao tiếp decoupled giữa các System, State Pattern cho trạng thái người chơi/vòng đấu, và Async/Await trong E2E testing.
