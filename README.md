# Nonogram Studio

Trò chơi giải đố nonogram (Picross) bằng tiếng Việt, chạy hoàn toàn trong trình duyệt. Chơi các câu đố tuyển chọn, giải bộ chỉ dẫn bất kỳ và xem từng bước suy luận, tự vẽ và chia sẻ câu đố, tìm hiểu mô hình ràng buộc và quy hoạch tuyến tính nguyên.

Ứng dụng không yêu cầu tài khoản, không có máy chủ và không theo dõi người dùng. Tiến độ được lưu trong LocalStorage của trình duyệt. Trang web tĩnh có thể triển khai lên GitHub Pages.

## Tính năng

- **Chơi:** nhấn để tô, nhấn chuột phải để đánh dấu trống, kéo để tô theo hàng/cột. Khi kéo, chỉ các ô có cùng trạng thái với ô bắt đầu mới thay đổi. Trên thiết bị cảm ứng, chuyển công cụ Tô ô / Đánh dấu ở thanh dưới cùng; kéo trên vùng chỉ dẫn để cuộn bảng lớn.
- **Bàn phím:** phím mũi tên để di chuyển, Space để tô, X để đánh dấu trống, Delete để xóa, Shift + mũi tên để lặp thao tác trước. Ctrl+Z / Ctrl+Y để hoàn tác / làm lại, H để gợi ý, C để kiểm tra, T để đổi công cụ.
- **Tiến độ:** tự lưu, đồng hồ tạm dừng khi ẩn thẻ, kỷ lục cá nhân, hoàn tác / làm lại, đặt lại, hiện đáp án và chuyển sang câu tiếp theo, câu ngẫu nhiên hoặc câu tự tạo. Chỉ dẫn hoàn thành được gạch ngang; chỉ dẫn không thể hoàn thành chuyển đỏ. Mọi cách tô thỏa mãn chỉ dẫn đều được chấp nhận.
- **Gợi ý có giải thích:** chỉ ra hàng/cột mâu thuẫn; kiểm tra tính nhất quán của toàn bảng; suy luận các ô có cùng trạng thái trong mọi cách sắp xếp; thử trước một bước. Khi các cách này không đủ, ứng dụng báo rõ việc hiện ô từ đáp án.
- **Thư viện:** 40 câu đố, mỗi nhóm 10 câu ở kích thước 5×5, 8×8, 10×10 và 15×15. Mỗi câu đã được chứng minh có đúng một nghiệm. Tên chỉ hiện khi giải xong; ảnh xem trước thể hiện tiến độ. Lọc theo độ khó, kích thước và trạng thái; tiếp tục lượt chơi gần nhất hoặc chọn ngẫu nhiên câu chưa giải.
- **Bộ giải:** nhập chỉ dẫn cho bảng tối đa 30×30. Kết quả phân biệt nghiệm duy nhất, nhiều nghiệm, vô nghiệm và dừng tại giới hạn bước. Xem lại nhật ký thực tế gồm suy luận, phỏng đoán, mâu thuẫn và quay lui, với điều khiển phát, dừng, từng bước và tốc độ. Có thống kê tìm kiếm và thời gian xử lý.
- **Tạo câu đố:** vẽ bảng từ 5 đến 25 ô mỗi cạnh, chỉ dẫn cập nhật trực tiếp. Kiểm tra nghiệm duy nhất, tô bóng các ô khác nhau giữa hai nghiệm, lưu, chơi thử, nhập / xuất JSON, mở trong bộ giải hoặc chia sẻ qua liên kết chứa câu đố.
- **Hướng dẫn:** luật chơi, cách đọc chỉ dẫn, kỹ thuật giải tay, thử nghiệm hàng/cột tương tác, bài toán thỏa mãn ràng buộc, thuật toán bộ giải và mô hình ILP bằng KaTeX. Xuất mô hình của câu đố trong thư viện thành tệp CPLEX `.lp`.
- **Cài đặt:** giao diện sáng / tối / theo hệ thống, giảm chuyển động, âm thanh, khóa hướng kéo, làm nổi bật hàng/cột, tự đánh dấu ô trống và xóa tiến độ.

## Công nghệ

React 19, TypeScript ở chế độ nghiêm ngặt, Vite, Tailwind CSS 4, Lucide, KaTeX, IBM Plex Sans và Plex Mono được phục vụ nội bộ qua Fontsource, Vitest. Bộ giải, gợi ý và tạo câu đố chạy trong Web Worker. Trang hướng dẫn được tải riêng khi cần.

## Chạy project

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Mở địa chỉ mà Vite hiển thị, mặc định là `http://localhost:5173`.

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Chạy máy chủ phát triển |
| `npm run typecheck` | Kiểm tra TypeScript của ứng dụng và các script |
| `npm test` | Chạy bộ kiểm thử Vitest |
| `npm run build` | Tạo bản phát hành trong `dist/` |
| `npm run preview` | Xem thử bản phát hành |
| `npm run generate:puzzles` | Tạo lại `src/data/puzzles.ts` từ `scripts/art.ts` |
| `npm run export:lp -- b01-heart` | Xuất mô hình ILP của một câu đố |

## Triển khai lên GitHub Pages

1. Đẩy project lên kho GitHub, nhánh `main`.
2. Mở **Settings → Pages**, chọn **Source → GitHub Actions**.
3. Đẩy thay đổi lên `main`. Workflow `.github/workflows/deploy.yml` sẽ cài gói, kiểm tra kiểu, chạy kiểm thử, build và triển khai.

Địa chỉ trang có dạng `https://USERNAME.github.io/REPOSITORY/`. Workflow truyền `BASE_PATH=/REPOSITORY/` cho Vite để đường dẫn tài nguyên và worker chứa tên kho. Điều hướng dùng phần hash như `#/library` hoặc `#/play/b01-heart`, nên tải lại trang không cần cấu hình viết lại URL trên máy chủ.

Để build cho đường dẫn khác trong PowerShell:

```powershell
$env:BASE_PATH = '/my-path/'
npm run build
```

## Cấu trúc project

| Thư mục | Nội dung |
| --- | --- |
| `src/engine/` | Logic TypeScript thuần: chỉ dẫn, quy hoạch động, bộ giải, kiểm tra, gợi ý, lịch sử, tạo câu đố và mô hình ILP |
| `src/workers/` | Worker xử lý tính toán nền |
| `src/lib/` | Lưu trữ có phiên bản, liên kết chia sẻ, nhập / xuất JSON và giao tiếp worker |
| `src/features/` | Các màn chơi, thư viện, bộ giải, tạo câu đố, hướng dẫn và cài đặt |
| `src/components/` | Bảng chơi, ảnh xem trước, điều hướng và menu |
| `src/data/` | Thư viện câu đố được sinh tự động |
| `src/tests/` | Các bộ kiểm thử Vitest |
| `scripts/` | Bản vẽ gốc, sinh câu đố và xuất mô hình LP |

## Kiến trúc bộ giải

**Giải từng hàng/cột:** với chỉ dẫn gồm *k* đoạn trên hàng/cột dài *n* ô, quy hoạch động trên trạng thái (ô, đoạn) xác định mỗi ô có thể tô hay để trống trong các cách sắp xếp hợp lệ. Ô chỉ có một khả năng được xác định ngay. Cùng bảng trạng thái đếm số cách sắp xếp mà không cần liệt kê. Chi phí khoảng O(n·k), nhân thêm độ dài đoạn khi kiểm tra vị trí.

**Lan truyền:** hàng đợi chứa các hàng/cột có thể thay đổi. Khi xác định một ô, đưa hàng/cột giao nhau vào hàng đợi. Nếu một hàng/cột không còn cách sắp xếp, trạng thái hiện tại mâu thuẫn.

**Tìm kiếm:** khi lan truyền dừng, chọn hàng/cột chưa xong có ít cách sắp xếp nhất, chọn ô chưa biết gần giữa, thử tô rồi để trống trên từng bản sao bảng. Dừng sau hai nghiệm là đủ để xác định tính duy nhất. Chỉ kết luận nghiệm duy nhất khi tìm kiếm hoàn tất và có đúng một nghiệm. Giới hạn bước ngăn tìm kiếm quá lâu; giao diện có thể hủy tác vụ bằng cách kết thúc worker. Mã tác vụ giúp bỏ qua phản hồi cũ.

Bộ kiểm thử đối chiếu thuật toán với liệt kê vét cạn trên các bảng nhỏ ngẫu nhiên và các hàng/cột có thông tin một phần.

## Sinh câu đố

`scripts/generate-puzzles.ts` tạo thư viện một cách xác định từ các bản vẽ trong `scripts/art.ts`. Nếu chỉ dẫn cho nhiều nghiệm, script đổi các ô khác nhau giữa hai nghiệm, ưu tiên mép hình, cho đến khi chứng minh được tính duy nhất. Các thay đổi được ghi trong `scripts/generation-report.md`.

Năm câu họa tiết 15×15 được tạo từ các mã khởi tạo cố định, dùng nhiễu ngẫu nhiên làm mượt và có thể đối xứng. Script không ghi câu đố chưa được chứng minh có nghiệm duy nhất. Kiểm thử xác minh lại cả 40 câu: kích thước, chỉ dẫn, đáp án hợp lệ và tính duy nhất.

Tên và mô tả câu đố bằng tiếng Việt; trường `slug` của bản vẽ giữ mã định danh ổn định để liên kết và tiến độ đã lưu vẫn dùng được khi tạo lại thư viện. Ứng dụng chỉ đọc tệp dữ liệu đã tạo; tùy chọn tạo ngẫu nhiên khi chơi dùng cùng thuật toán với mã khởi tạo ngẫu nhiên.

## Mô hình ILP

Với mỗi hàng, biến nhị phân biểu thị vị trí bắt đầu từng đoạn. Ràng buộc đảm bảo mỗi đoạn bắt đầu đúng một lần, giữ thứ tự và có ít nhất một ô trống giữa hai đoạn. Biến nhị phân của mỗi ô bằng tổng các biến vị trí có đoạn bao phủ ô đó. Cột có các nhóm ràng buộc tương tự và dùng chung biến ô với hàng. Hàm mục tiêu là hằng số. Trang Hướng dẫn trình bày công thức đầy đủ, gồm ràng buộc loại nghiệm để kiểm tra tính duy nhất.

Bộ giải trong trình duyệt dùng lan truyền và quay lui. Tệp `.lp` được xuất để dùng với công cụ ILP bên ngoài như HiGHS, GLPK, CBC hoặc Gurobi. Trong quá trình phát triển, các mô hình xuất thử đã được giải bằng HiGHS và khớp đáp án lưu sẵn.

## Dữ liệu và quyền riêng tư

Dữ liệu được lưu trong `localStorage` với khóa `nonogram-studio`, phiên bản cấu trúc 2. Mỗi bản ghi được kiểm tra riêng, nên một bản ghi hỏng không xóa phần còn lại. Dữ liệu không đọc được được sao lưu vào `nonogram-studio:unreadable`. Liên kết chia sẻ chứa câu đố trong phần hash của URL, vốn không được trình duyệt gửi lên máy chủ.

Việc Việt hóa giữ nguyên khóa lưu trữ, đường dẫn điều hướng và định dạng JSON. Các trường kỹ thuật như `format`, `rows`, `cols`, `solution` và cú pháp tệp LP giữ nguyên để tương thích.

## Giấy phép

MIT. Xem [LICENSE](LICENSE).
