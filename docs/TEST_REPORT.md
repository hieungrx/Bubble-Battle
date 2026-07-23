# TEST REPORT

| Test case | Expected | Actual | Status |
| --- | --- | --- | --- |
| Player 1 movement | Di chuyển độc lập | Di chuyển độc lập bằng W, A, S, D | PASS |
| Player 2 movement | Di chuyển độc lập | Di chuyển độc lập bằng Arrow Keys | PASS |
| Wall collision | Không xuyên tường | Người chơi và explosion hitbox bị chặn | PASS |
| Crate collision | Không xuyên thùng | Người chơi không thể đi qua, explosion bị chặn và phá được thùng | PASS |
| Balloon placement | Đặt đúng grid | Bóng tự căn chỉnh vào tâm của ô hiện tại | PASS |
| Balloon limit | Không vượt giới hạn | Không thể đặt số bóng vượt quá giới hạn activeBalloons | PASS |
| Balloon fuse | Nổ đúng thời gian | Nổ sau 2s (balloonFuseDuration) | PASS |
| Wall blocks water | Không xuyên wall | Explosion bị dừng tại Wall | PASS |
| Crate destruction | Phá crate đầu tiên | Explosion phá crate đầu tiên gặp phải và dừng lan hướng đó | PASS |
| Player trapped | Chuyển đúng state | Người chạm hitbox nổ sẽ chuyển state = TRAPPED, không di chuyển được | PASS |
| Player eliminated | Loại sau timer | Sau 3s bị trap, chuyển state = DEAD | PASS |
| Draw resolution | Không chọn sai winner | Cả 2 chết cùng lúc hoặc hết giờ sẽ báo Draw | PASS |
| Restart cleanup | Không còn object cũ | GameScene reset toàn bộ Object, System và Listener khi quay lại | PASS |
| Production build | Build thành công | `npm run build` không lỗi, bundle Vite pass | PASS |
