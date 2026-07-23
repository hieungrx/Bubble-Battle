# Bubble Battle: Campus Chaos

## Giới thiệu
Bubble Battle: Campus Chaos là một trò chơi 2D đối kháng local hai người chơi lấy cảm hứng từ thể loại đặt bóng nước cổ điển. Game được phát triển bằng Phaser 3 và Vite, thuộc framework JavaScript thuần.

## Công nghệ
- JavaScript ES6+
- Phaser 3.x
- Vite
- HTML5 / CSS3
- ES Modules
- Arcade Physics

## Cài đặt
1. Clone dự án:
   ```bash
   git clone <repository_url>
   ```
2. Cài đặt các package cần thiết:
   ```bash
   npm install
   ```

## Chạy development
   ```bash
   npm run dev
   ```

## Build production
   ```bash
   npm run build
   ```

## Phím điều khiển
### Player 1 (Màu đỏ)
- **Lên:** W
- **Xuống:** S
- **Trái:** A
- **Phải:** D
- **Đặt bóng:** SPACE

### Player 2 (Màu xanh)
- **Lên:** Arrow Up
- **Xuống:** Arrow Down
- **Trái:** Arrow Left
- **Phải:** Arrow Right
- **Đặt bóng:** ENTER

## Luật chơi
- Hai người chơi xuất phát ở hai góc của bản đồ.
- Có thể đặt bóng nước. Bóng tự động phát nổ sau 2 giây.
- Tia nước lan ra 4 hướng.
- Tia nước bị chặn lại khi gặp tường cứng (Wall).
- Tia nước sẽ phá hủy thùng (Crate) đầu tiên nó chạm tới và không lan xuyên qua.
- Người chơi chạm phải tia nước sẽ bị nhốt (TRAPPED) trong 3 giây. Hết 3 giây người chơi sẽ bị loại (DEAD).
- Người chơi còn sống cuối cùng sẽ thắng.
- Hết giờ (2 phút) mà chưa phân thắng bại hoặc 2 người cùng chết sẽ tính là hòa.

## Cấu trúc code
- `src/main.js`: Entry point chính, khởi tạo Phaser Game.
- `src/config.js`: Cấu hình engine của trò chơi (scene, kích thước, physics).
- `src/scenes/`: Các class điều hướng giao diện (Menu, Game, Result).
- `src/entities/`: Các class đại diện cho nhân vật (Player) và đồ vật (WaterBalloon).
- `src/systems/`: Logic xử lý bản đồ (GridMapSystem), hiệu ứng nổ (ExplosionSystem) và vòng đấu (RoundManager).
- `src/constants/`: Constants cho luật chơi và trạng thái.

## Kiến thức JavaScript nâng cao đã áp dụng
- Class và inheritance (`class extends Phaser.Scene`).
- ES6 Modules (`import / export`).
- Array, ma trận 2 chiều (`level01`).
- Event emitter (xử lý timer và explosion).
- Pure function (Grid/World translation logic).

## Giới hạn phiên bản
- Không có chế độ chơi Multiplayer online.
- Không có backend, database hay hệ thống đăng nhập.
- Asset hiện tại dùng hình khối giữ chỗ (Placeholder) để tập trung vào logic game.

## Nguồn asset và giấy phép
- Mọi hình ảnh (nhân vật, tường, thùng, bóng) được sinh ra bằng Phaser Graphics (không dùng asset có bản quyền).
