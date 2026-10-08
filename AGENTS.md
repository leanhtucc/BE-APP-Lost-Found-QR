# AGENTS.md

Tài liệu nền cho AI agent làm việc trong repository này. Đọc file này trước khi sửa code. README.md mô tả cài đặt và API ở mức tổng quan; `docs/` chứa hướng dẫn chi tiết theo module.

## Tổng quan dự án

Đây là backend API TypeScript cho ứng dụng Lost & Found. Stack chính gồm Node.js, Express 5, PostgreSQL, Prisma 7, Zod và Vitest. Dự án tích hợp thêm Supabase Auth, Firebase Admin/FCM, Stream Chat, Socket.IO, email, Redis/Upstash và các dịch vụ AI. Không giả định mọi tích hợp đều được bật ở mọi môi trường; xem `src/config/env.ts` và cấu hình riêng của từng tích hợp.

## Cấu trúc quan trọng

- `src/server.ts`: khởi động database, HTTP server, Socket.IO và các background jobs; có kiểm tra an toàn database trước khi chạy.
- `src/app.ts`: tạo Express app, cấu hình middleware bảo mật, CORS, body parsing, static files, rate limit và error handlers.
- `src/routes.ts`: đăng ký health checks, API prefix và các route tương thích `/v1`.
- `src/modules/<module>/`: chức năng theo domain. Module thường có routes, controller, service, schema, types và đôi khi repository/test.
- `src/middlewares/`: authentication, validation, lỗi, rate limiting và chuyển query thành body.
- `src/config/`, `src/libs/`, `src/utils/`: cấu hình môi trường, tích hợp dùng chung và tiện ích.
- `src/jobs/`, `src/socket/`: tác vụ nền và sự kiện thời gian thực.
- `src/templates/`: template email; build có bước copy sang `dist/templates`.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/*.ts`: schema, lịch sử database và seed.
- `docs/`: hướng dẫn API, vận hành, kiến trúc và handoff frontend. `docs/README.md` là mục lục.
- `.agents/skills/`: quy trình và hướng dẫn agent của repository.

## Quy trình làm việc

- Trước khi sửa, lần theo luồng liên quan từ route đến controller, service, repository/database và schema; kiểm tra test cùng tài liệu của module đó.
- Giữ thay đổi trong module và phạm vi yêu cầu. Tái sử dụng pattern hiện có thay vì tạo tầng hoặc abstraction mới không cần thiết.
- Route/controller xử lý HTTP; service giữ business logic; repository (nếu module có) giữ truy cập dữ liệu. Dùng Zod schema và middleware validation cho input API.
- Giữ tương thích với các route `/v1` hiện có. Khi thay đổi contract, kiểm tra cả nơi đăng ký route và tài liệu/handoff liên quan.
- Với thay đổi schema Prisma, chỉnh `prisma/schema.prisma` và tạo migration phù hợp; không sửa migration đã áp dụng. Chạy `prisma generate` khi cần cập nhật client.
- Không đưa secret, token, thông tin cá nhân hay nội dung `.env` vào code, log, tài liệu hoặc output. Chỉ dùng các file `.env.example` làm mẫu; không đọc hay in giá trị bí mật từ `.env`.
- Không bỏ qua các guard an toàn database trong `src/config/database-safety.ts` và `src/config/phase4-test-safety.ts`. Không chạy seed, migration hoặc test tích hợp có khả năng ghi/xóa dữ liệu trên database chưa được xác nhận là môi trường phù hợp.
- Hạn chế thay đổi response/error contract, xác thực, quyền sở hữu dữ liệu, thanh toán và notification nếu yêu cầu không bao gồm chúng.

## Lệnh dự án

- `npm run dev`: chạy server development bằng `tsx watch`.
- `npm run build`: generate Prisma Client, biên dịch TypeScript và copy email templates.
- `npm start`: chạy `dist/server.js`.
- `npm run typecheck`: kiểm tra TypeScript không phát sinh output.
- `npm test`: chạy Vitest một lần.
- `npm run test:watch`: chạy Vitest ở chế độ watch.
- `npm run format:check`: kiểm tra format Prettier trong `src/`.
- `npm run prisma:generate`: generate Prisma Client.
- `npm run prisma:migrate`: tạo và áp dụng migration trong môi trường phát triển.
- `npm run prisma:deploy`: áp dụng migration đã tạo trong môi trường deploy.

Chỉ chạy kiểm tra phù hợp với phạm vi thay đổi và chỉ khi người dùng yêu cầu kiểm tra/xác minh hoặc quy trình skill được gọi yêu cầu. Không chạy lệnh ghi dữ liệu production.

## Quy ước code

- Dùng TypeScript strict hiện được cấu hình trong `tsconfig.json`; giữ kiểu rõ ràng và xử lý đầy đủ trường hợp lỗi.
- Theo style hiện có: dấu nháy kép, dấu chấm phẩy, format Prettier; không format lại file không liên quan.
- Tên file module theo pattern hiện hữu, ví dụ `item.routes.ts`, `item.controller.ts`, `item.service.ts`, `item.schema.ts`.
- Dùng logger dự án (`src/libs/logger.ts`) thay vì thêm `console.log` vào code chạy production.
- Không giả định nội dung README luôn khớp hiện trạng; xác minh bằng code, `package.json`, schema và tài liệu module trước khi kết luận.

## Skills và tài liệu

Các skill repository nằm trong `.agents/skills/`. Đọc file `SKILL.md` của skill trước khi thực hiện luồng tương ứng; skill có thể tham chiếu các file hướng dẫn bổ sung cùng thư mục.

- `/scope`: lập hoặc cập nhật phạm vi tính năng trong `docs/scope/`.
- `/architect`: quyết định kiến trúc và viết spec trong `docs/specs/`.
- `/develop`: triển khai theo spec đã chốt và quy ước dự án.
- `/test`: tạo bộ test cho thay đổi code.
- `/check verify`: chạy ứng dụng và xác minh theo tiêu chí chấp nhận.
- `/check review`: review diff độc lập và ghi nhận finding.
- `/debug`: tìm nguyên nhân và sửa lỗi theo vòng lặp tái hiện, khoanh vùng, xác minh.
- `/document`: viết PR, changelog, release note hoặc postmortem từ thay đổi thực tế.
- `/sync`: đồng bộ tài liệu bền vững sau khi thay đổi hoàn tất.
- `/audit`: khởi tạo hoặc bổ sung hướng dẫn AI trong `AGENTS.md`.

Tài liệu API và vận hành nên được tra từ `docs/README.md`. Một số tài liệu cũ có thể nêu tính năng hoặc kiến trúc khác với code hiện tại; dùng implementation hiện tại làm căn cứ và ghi nhận chỗ lệch nếu liên quan.

## Git

- Giữ nguyên thay đổi sẵn có của người dùng; xem `git status` trước khi chỉnh sửa và không ghi đè thay đổi ngoài phạm vi.
- Không tự commit, push, tạo PR hoặc đổi nhánh trừ khi người dùng yêu cầu.
- Chỉ đưa vào diff các file cần thiết cho yêu cầu.
