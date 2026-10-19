# UI/UX polish plan: chi tiết (draft để review)

| | |
|---|---|
| **Owner** | Huấn (`apps/web/**`, `apps/server/src/copy/**`, `e2e/**`, `docs/ux/**`) |
| **Status** | **DRAFT. Chưa code dòng nào.** Chỉ bắt đầu khi Huấn ghi "OK" (cho cả plan hoặc từng phase). |
| **Ngày** | 2026-10-19 |
| **Feature IDs** | H4·ui (dashboard), A6 (onboarding), A9·ui (network), N10·ui (panic), N4·ui, N1·ui, F3·ui, N14 (guide), N18 (a11y) |
| **Bằng chứng** | Ảnh chụp mới sau khi sign in bằng burner testnet, ở light và dark: `e2e/screenshots/audit-{light,dark}-*.png` (gitignored, chỉ có local). Ảnh signed-out: `e2e/screenshots/smoke-*.png`. Số liệu ở §11 đo bằng grep trên `apps/web/src`. |

**Cách đọc:**

- §1–§2 là luật chung.
- §3 liệt kê **mọi vấn đề**, mỗi vấn đề có ID, mức độ, file, bằng chứng, cách sửa và tiêu chí nghiệm thu.
- §4–§5 là spec của component và wireframe.
- §6 là các task theo phase, có checkbox.
- §7 là kế hoạch test. §8 là rủi ro. §10 là các câu hỏi bạn cần chốt.

**Mức độ:**

- 🔴 **cao**: người dùng thấy ngay hoặc dễ bấm nhầm.
- 🟠 **vừa**: thiếu nhất quán, nhìn không chuyên nghiệp.
- 🟢 **thấp**: đánh bóng.

---

## 1. Ràng buộc (không được phá)

1. **Chỉ sửa trong lane của Huấn.** Gồm `apps/web/**` (trừ `features/lab/`), `apps/server/src/copy/**`, `e2e/**` và `docs/ux/**`. Không đụng logic backend, `packages/schema` hay Move.
2. **File dùng chung cần contract PR** (cả Uy và Huấn duyệt): `apps/web/src/app/routes.tsx`, `apps/web/src/lib/api.ts`, `packages/schema/**`. Mọi thay đổi route (Q1, Q5) phải đi qua PR này.
3. **Phần của Uy chỉ gửi handoff**, không sửa: message sign-in "Sign in to hippo" và cookie `hippo_session`/`hippo_guest` trong `apps/server/src/routes/auth.ts`.
4. **ADR bắt buộc**, nằm cùng commit với thay đổi:
   - **ADR-0036** "UI foundation": theme ấm, component trang, shell gọn.
   - **ADR-0037** "Network dropdown thay toggle + badge": bổ sung phần UI của ADR-0026, giữ nguyên quyết định "một deployment, hai network".
   - Nếu Q1 chọn đổi trang chủ thì thêm **ADR-0038** "Home = dashboard, chat chuyển sang `/chat`".
5. **Không đổi hành vi.** Mọi luồng ký, gọi API và polling giữ nguyên. Chỉ đổi cách trình bày, trừ hai chỗ được ghi rõ: thêm bước confirm (B2, D3, D7) và gộp hai nút panic (E1).
6. **E2E phải xanh sau mỗi phase.** Đổi label hay test id nào thì sửa test trong cùng commit (§7.2).
7. **Không deploy.** Push lên `main` theo quy trình: `git pull --rebase` → `typecheck`, `lint`, `test` → `git push origin HEAD:main`.

---

## 2. Design rules (luật áp dụng cho mọi trang, mọi PR sau này)

### 2.1 Màu (token)

Hướng tham khảo là Claude.ai: **neutral ấm** (hue khoảng 85–90, chroma rất thấp), nền không trắng tinh và không đen kịt, ít viền, một màu nhấn. Màu nhấn của Remora là **teal dịu**, dùng **một sắc độ cho cả 2 theme** (dark chỉ sáng hơn một bậc).

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--background` | `oklch(0.985 0.004 90)` ≈ #FAF9F6 | `oklch(0.27 0.004 85)` ≈ #262624 | nền vùng nội dung |
| `--sidebar` | `oklch(0.965 0.006 90)` ≈ #F3F1EC | `oklch(0.235 0.004 85)` ≈ #1F1E1C | sidebar + nền ngoài khung |
| `--card`, `--popover` | `oklch(0.995 0.002 90)` | `oklch(0.31 0.004 85)` ≈ #2F2E2B | card, menu, dialog |
| `--muted`, `--secondary`, `--accent` | `oklch(0.955 0.006 90)` | `oklch(0.33 0.004 85)` | hover, nền chip, tile |
| `--foreground` | `oklch(0.26 0.008 85)` ≈ #2B2A27 | `oklch(0.93 0.006 90)` ≈ #ECEAE4 | chữ chính |
| `--muted-foreground` | `oklch(0.50 0.01 85)` | `oklch(0.72 0.01 85)` | chữ phụ (tương phản ≥ 4.5:1 trên nền) |
| `--border`, `--input` | `oklch(0.90 0.006 90)` | `oklch(1 0 0 / 9%)` | viền 1px |
| `--primary` | `oklch(0.50 0.07 195)` | `oklch(0.68 0.07 195)` | nút primary, link, focus |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.20 0.02 200)` | chữ trên primary |
| `--ring` | = primary, alpha 50% | = primary, alpha 50% | focus ring |
| `--destructive` | `oklch(0.56 0.17 28)` | `oklch(0.66 0.15 28)` | phá huỷ, lỗi |
| `--success` *(mới)* | `oklch(0.55 0.11 155)` | `oklch(0.72 0.11 155)` | verified, live, done |
| `--warning` *(mới)* | `oklch(0.70 0.13 75)` | `oklch(0.78 0.12 80)` | testnet, settling, cảnh báo index |
| `--brand` | **bỏ**, gộp vào `--primary` | | hiện có 2 teal khác nhau (E3) |

Luật:

- **Cấm** class palette viết cứng (`amber-*`, `green-*`, `emerald-*`, `red-*`…) và cấm hex (`#156BC1`…) trong `apps/web/src` (trừ `components/ui`, vốn là kit).
- Mỗi màu ngữ nghĩa có biến thể nền nhạt cho badge và alert: `bg-success/12 text-success`, `bg-warning/15 text-warning-foreground`…
- `<meta name="theme-color">` trong `index.html` đổi theo `--background` mới (#FAF9F6 / #262624).

### 2.2 Chữ

| Vai trò | Class | Cỡ | Ở đâu |
|---|---|---|---|
| Tiêu đề trang | `text-2xl font-semibold tracking-tight` | 24px | `PageHeader` (mobile `text-xl`) |
| Tiêu đề mục | `text-base font-semibold` | 16px | `Section`, `CardTitle` |
| Nội dung | `text-sm` (màu `foreground`) | 14px | mặc định cho mọi câu văn |
| Chữ phụ | `text-sm text-muted-foreground` | 14px | mô tả, hint dưới input |
| Metadata | `text-xs text-muted-foreground` | 12px | **chỉ** thời gian, mã hash, nhãn stat tile, badge |
| Số lớn | `text-3xl font-semibold tabular-nums` | 30px | `StatTile` |
| Mono | `font-mono text-xs` | 12px | blob id, digest, địa chỉ (luôn kèm nút copy) |

Luật:

- **Không** dùng `text-xs` cho câu văn hoàn chỉnh.
- **Không** dùng `text-[Npx]`.
- **Không** đặt `text-muted-foreground` cho nội dung chính.
- Font: giữ system sans. Font serif `Instrument Serif` chỉ còn ở hero của Home, nếu Q6 đồng ý; còn không thì bỏ hẳn.

### 2.3 Khoảng cách, bo góc, bóng

- **Khoảng cách theo bậc 4px:** trong control `gap-2`; giữa các field `gap-4`; giữa các section `gap-8`; padding card `p-5`.
- **Padding trang:** `px-4 py-6` trên mobile, từ `md` trở lên `px-8 py-8`.
- **Bo góc:** giữ `--radius: 0.625rem`. Card `rounded-xl`, control `rounded-md`, badge `rounded-full`. Composer chat giữ `rounded-3xl` (ngoại lệ có chủ đích).
- **Bóng:** bỏ `shadow-sm` mặc định của `Card`. Chỉ popover, dialog và composer có bóng, và là bóng nhẹ.

### 2.4 Nút

| Tình huống | Variant | Size | Ghi chú |
|---|---|---|---|
| Hành động chính của trang hoặc form (mỗi màn **một** cái) | `default` | `default` (36px) | canh phải ở form; full-width **chỉ** dưới `sm` |
| Hành động phụ cạnh nút chính | `outline` | `default` | |
| Hành động trong hàng, card, toolbar | `outline` hoặc `ghost` | `sm` (32px) | |
| Icon trong header, toolbar, hàng | `ghost` | `icon-sm` (32px), icon 16px | luôn có `aria-label` + tooltip |
| Phá huỷ (Retire, Pause all, Panic) | `outline` + `text-destructive`; đổi sang `destructive` **trong dialog confirm** | theo ngữ cảnh | luôn qua `ConfirmAction` |
| Link trong câu | `<Link>` + class `link` | | không dùng `<button>` thô |

Luật:

- Không còn `size="icon"` (36px) ngoài composer.
- Không dùng `<button>` thô ngoài `components/ui`.
- Nút disabled không mang màu primary đậm: ẩn đi, hoặc dùng `outline` disabled.
- Trạng thái busy: dùng `Spinner` + chữ ("Signing…") **ngay trong nút**, không viết một dòng chữ rời bên cạnh.

### 2.5 Layout trang

| Width | max-w | Trang |
|---|---|---|
| `narrow` | `max-w-2xl` (672px) | New remora, Settings, Verify, Onboarding/Home khi chưa có gì |
| `default` | `max-w-3xl` (768px) | Remoras, Remora detail, Funds, Approvals |
| `wide` | `max-w-5xl` (1024px) | Memory (bảng), Guide |
| chat | đặc thù: `max-w-3xl` + panel | Chat |

Mọi thứ nằm trong trang (banner reconnect, lỗi, nội dung) đều ở **bên trong** container nên luôn thẳng hàng.

### 2.6 Trạng thái

| Trạng thái | Component | Luật |
|---|---|---|
| Đang tải lần đầu | `Skeleton` theo hình nội dung | không dùng chữ "Loading…" trần |
| Rỗng | `EmptyState` (icon + tiêu đề + 1 câu + 1 CTA) | luôn có bước tiếp theo |
| Lỗi | `Alert variant="destructive"` + nút "Try again" | không dùng `<p className="text-destructive">` trần |
| Đang ký hoặc đang chờ chain | chữ trong nút + toast khi xong | lời nhắc "check your wallet" nằm trong nút |
| Badge trạng thái remora | `StatusBadge` | xem bảng ở §4 |

### 2.7 Văn phong (copy)

- Câu ngắn, chủ động, không kỹ thuật khi không cần ("Ready to spend", thay vì "Ready (address balance)").
- Thuật ngữ riêng (Disc, Wake, address balance) có tooltip giải thích lần đầu xuất hiện (N14).
- Tiếng Anh (UI hiện tại). i18n tiếng Việt nằm ngoài phạm vi (§9).

---

## 3. Audit: vấn đề → cách sửa → nghiệm thu

### A. Nền tảng

#### A1 🔴 Theme quá gắt, hai theme lệch tông
- **File:** `apps/web/src/index.css` dòng 9–74
- **Bằng chứng:** light `--background: oklch(1 0 0)` (trắng tinh), `--foreground: oklch(0.145 0 0)`. Dark `--background: oklch(0.145 0 0)` ≈ #0a0a0a. Primary light `0.42 0.08 205` (teal tối), primary dark `0.8 0.1 200` (cyan sáng): nút dark rất chói (`audit-dark-remoras.png`: "New remora", "Connect wallet to sign").
- **Sửa:** thay toàn bộ biến trong `:root` và `.dark` theo §2.1. Sidebar token dùng `--sidebar*` cùng họ màu (bỏ các giá trị `hsl(240 …)` lạnh và `--sidebar-ring` xanh dương).
- **Nghiệm thu:** chụp lại 11 trang ở 2 theme; không còn màu xám lạnh; tương phản `foreground` và `muted-foreground` đạt AA (kiểm bằng DevTools).

#### A2 🟠 Không có token success/warning, màu viết cứng rải rác
- **Bằng chứng:**
  - `network-switch.tsx`: `bg-amber-500`, banner `bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100`
  - `funds-page.tsx`: `text-amber-600` ("Settling…")
  - `memory-page.tsx`: `border-amber-500/50`
  - `verify-page.tsx`: `text-emerald-600`
  - `copy-button.tsx`: `text-green-*`
  - hex: `chat-turn.tsx:113` `bg-[#E8F3FE]`, `composer-shell.tsx:100` và `slash-menu-panel.tsx:34` `text-[#156BC1] dark:text-[#8EBEF5]`
- **Sửa:**
  - thêm `--success`, `--warning` (+ `-foreground`) và đăng ký trong `@theme inline`;
  - thêm variant `success`, `warning` cho `components/ui/badge.tsx` và `components/ui/alert.tsx`;
  - thay tất cả chỗ trên bằng token. Màu lệnh `/command` dùng `text-primary`; bubble người dùng dùng `bg-muted`.
- **Nghiệm thu:** `grep -rE "(bg|text|border)-(amber|green|emerald|red|yellow|blue|sky|orange|rose)-[0-9]" apps/web/src --include=*.tsx | grep -v components/ui` ra 0 dòng; `grep -rE "#[0-9A-Fa-f]{6}"` (cùng phạm vi) ra 0 dòng.

#### A3 🔴 Quá nhiều chữ nhỏ và xám; trang không có tiêu đề
- **Bằng chứng:** 135 chỗ `text-sm`, 29 `text-xs`, 1 `text-[11px]`. Tên trang chỉ có ở header (`app-layout.tsx`: `<p className="… text-sm text-muted-foreground">{title}</p>`). Funds có nhãn 12px ("Ready (address balance)"). Onboarding dùng `CardDescription` xám cho cả câu hướng dẫn.
- **Sửa:** áp thang chữ §2.2; mỗi trang có `PageHeader` (§4). Rà từng file ở §6 Phase 3.
- **Nghiệm thu:** mọi route có đúng một `h1` (kiểm trong `pages.test.tsx`); `text-[11px]` = 0; `text-xs` chỉ xuất hiện trong metadata, mono và badge (review bằng tay theo danh sách §11).

#### A4 🔴 Nút không cùng cỡ, không dùng chung component
- **Bằng chứng:**
  - Header có 3 cỡ: `PanicButton` `size="sm"` 32px, `ToggleGroup` `size="sm"` 32px, `ThemeToggle` `size="icon"` 36px.
  - `feed-list.tsx`: 👍/👎 dùng `size="icon"` 36px trong hàng chữ 14px.
  - `settings-page.tsx`: nút Save `className="self-start"` nằm trong grid 2 cột, nên rộng nửa card (`audit-light-settings.png`).
  - `hooks.tsx` (`RequireOwner`): `WalletPicker` full-width ở trạng thái signed-out (`smoke-remoras.png`).
  - `<button>` thô ở `chat/recalled.tsx`, `chat/examples.tsx`, `chat/follow-up-row.tsx`, `remoras/new-remora-page.tsx`.
  - "Open memory" ở chat là `ghost` `default` 36px, trong khi các nút toolbar khác là 32px.
- **Sửa:** áp bảng §2.4; thay 4 `<button>` thô (template card dùng `RadioGroup` dạng card, examples và follow-up dùng `Button variant="ghost" size="sm"`, recalled dùng `Button variant="link"`).
- **Nghiệm thu:** `grep -rn "<button" apps/web/src --include=*.tsx | grep -v components/ui | grep -v test` = 0; `size="icon"` chỉ còn ở composer; mọi control trong header cao 32px (đo bằng DevTools).

#### A5 🔴 Độ rộng và padding trang không thống nhất, nội dung lệch
- **Bằng chứng:**
  - Container có 6 mức: `max-w-md` (funds signed-out), `max-w-xl` (RequireOwner signed-out, chat empty), `max-w-2xl` (onboarding, new, settings, verify, lab), `max-w-3xl` (remoras, remora, funds, approvals, chat), `max-w-4xl` (guide), `max-w-5xl` (memory, me).
  - Padding: `p-4`, `p-6`, `p-8`, `px-4 py-6`, `px-4 py-8`.
  - Banner "Signed in as…" trong `RequireOwner` luôn `max-w-3xl`, nhưng nội dung Settings và New là `max-w-2xl`, nên **lệch nhau** (`audit-light-settings.png`, `audit-light-remoras-new.png`).
  - Memory khi rỗng render `<p className="p-6">` ngoài container nên dính trái (`audit-light-memory.png`).
- **Sửa:** component `Page` (§4) là nơi duy nhất quyết định width và padding; `RequireOwner` chỉ cung cấp state, banner render bên trong `Page`.
- **Nghiệm thu:** `grep -rn "max-w-" apps/web/src/features --include=*-page.tsx` chỉ còn trong `Page`, chat và guide; ảnh chụp cho thấy mép trái của banner và nội dung trùng nhau.

#### A6 🟠 Card ở khắp nơi, viền và bóng dày
- **Bằng chứng:** `Card` mặc định có `shadow-sm py-6 gap-6`. Onboarding có 5 card, Settings 3, Remora detail 6, Funds 2 card lồng thêm tile có viền.
- **Sửa:**
  - đổi `components/ui/card.tsx` sang không bóng, `gap-4 py-5`;
  - thêm `Section` (không viền) cho các nhóm form và thông tin;
  - Card chỉ dùng cho **đối tượng** (remora, Disc, approval, template).
- **Nghiệm thu:** Settings, Onboarding và Funds không còn card bọc nhóm form; tối đa một tầng viền lồng nhau.

#### A7 🟠 Trạng thái rỗng sơ sài
- **Bằng chứng:**
  - `feed-list.tsx`: "Nothing yet."
  - `approvals-page.tsx`: "Nothing is waiting for you."
  - `memory-page.tsx`: "No remoras yet, so no memory to show." và dòng bảng "Nothing stored yet."
  - `disc-panel.tsx`: "No Discs yet. Creating a remora issues one (W2)." (còn nhắc "W2", là chữ nội bộ)
  - Kit có sẵn `components/ui/empty.tsx`; chỉ `me-page.tsx` dùng.
- **Sửa:** `EmptyState` (§4) với icon, tiêu đề, một câu và một CTA cho mỗi chỗ trên (nội dung cụ thể ở D1–D8).
- **Nghiệm thu:** không còn chuỗi "Nothing yet." trần; chuỗi "(W2)" bị xoá.

#### A8 🟢 Thời gian dạng dài
- **Bằng chứng:** `feed-list.tsx` dùng `new Date(e.createdAt).toLocaleString()`, ra "11/3/2026, 9:13:05 AM". Schedules và shadow cũng dùng `toLocaleString()`.
- **Sửa:** component `Time` dùng `lib/ago.ts` ("2h ago"), `title` hoặc tooltip là thời gian đầy đủ, bọc trong thẻ `<time dateTime>`.
- **Nghiệm thu:** feed hiện thời gian tương đối; hover thấy thời gian đầy đủ.

#### A9 🟢 Loading trần
- **Bằng chứng:** "Loading…" là `<p>` ở `hooks.tsx`, `remora-page.tsx`, `remoras-page.tsx`, `approvals-page.tsx`, `settings-page.tsx`, `me-page.tsx`.
- **Sửa:** `Skeleton` theo layout (card remora, hàng feed, form).
- **Nghiệm thu:** không còn chuỗi "Loading…" hiển thị một mình.

### B. Khung app (header, sidebar, title)

#### B1 🔴 Network: badge TESTNET + 2 nút toggle
- **File:** `features/network/network-switch.tsx`, `app/app-layout.tsx`
- **Bằng chứng:** badge cam `bg-amber-500` + `ToggleGroup` 2 nút, tổng khoảng 230px. Trên mobile 390px, tiêu đề bị cắt thành "Remor…" (`e2e/test-results/…mobile…/test-failed-1.png`).
- **Sửa:** `NetworkSelect` (§4):
  - một `DropdownMenu` (hoặc `Select`) cao 32px;
  - trigger gồm chấm màu (warning cho testnet, success cho mainnet), tên ("Testnet") và chevron;
  - item mainnet `disabled`, lý do ghi ngay dưới tên ("Not published yet");
  - giữ `data-testid="testnet-badge"` trên trigger khi network là testnet (để smoke không vỡ, hoặc đổi test như §7.2).
  - Lý do của ADR-0026 ("nobody mistakes test money") vẫn được giữ nhờ chấm cam và chữ "Testnet" luôn hiện.
- **Nghiệm thu:** header chỉ còn một control network; chọn mainnet bị chặn kèm lý do; E2E `x-remora-network` vẫn đúng.

#### B2 🔴 "Pause all" to, đỏ, nhảy layout, không confirm
- **File:** `features/funds/panic-button.tsx`, `app/app-layout.tsx`
- **Bằng chứng:**
  - `variant="destructive" size="sm"` có chữ, nền đỏ đặc (`testnet-funds-live.png`).
  - `if (!account || !cfg) return null;`, nên nút chỉ hiện khi wallet đang connect. Header đổi bố cục giữa các trang và các lần tải (`audit-dark-funds.png` không có nút, `testnet-funds-live.png` có).
  - Bấm là ký ngay.
- **Sửa:**
  - nút `ghost` `icon-sm`, icon `OctagonPause`, màu `muted-foreground`, hover sang `text-destructive`, tooltip "Pause all spending";
  - **luôn hiện khi đã sign in**. Nếu wallet chưa connect thì nút vẫn bấm được, mở dialog có nút "Connect wallet";
  - bấm thì mở `ConfirmAction`: tiêu đề "Pause all spending on testnet?"; nội dung "N Discs will stop paying until you resume each one."; nút xác nhận `destructive` "Pause N Discs".
  - Xem thêm E1 (gộp với Panic trong Settings).
- **Nghiệm thu:** nút không đổi vị trí giữa các trang; cần đúng 2 cú bấm (mở dialog → xác nhận) rồi ký; `aria-label="Pause all spending"` giữ nguyên.

#### B3 🟠 Nút theme to và đứng riêng
- **File:** `components/theme-toggle.tsx`, `app/app-layout.tsx`
- **Bằng chứng:** `size="icon"` 36px, đứng một mình ở góc phải header.
- **Sửa:**
  - Bỏ khỏi header, chuyển vào `AccountMenu` thành submenu "Theme" với 3 lựa chọn Light / Dark / System (radio).
  - Lưu `remora.theme` = `light` | `dark` | `system`; giữ script chống nháy trong `index.html` và thêm nhánh `system`.
  - Người **chưa sign in** vẫn đổi được theme: `AccountMenu` có dạng signed-out (nút "Sign in" + menu ⋯ chứa Theme).
- **Nghiệm thu:** header không có nút theme; System đi theo `prefers-color-scheme`; test `pages.test.tsx:461` ("switch to (dark|light)") được cập nhật.

#### B4 🔴 Sidebar quá dài, chat bị đẩy xuống, hai mục "Memory"
- **File:** `app/app-sidebar.tsx`, `components/channel-links.tsx`
- **Bằng chứng:** 11 mục (New chat, Get started, Remoras, Funds, Memory, Approvals, Verify, Settings, My memory, How it works); card Telegram/Discord nền teal khoảng 170px; avatar + địa chỉ mono.
- **Sửa** (wireframe ở §5.2):
  - **Nhóm chính:** `New chat` · `Home` (nếu Q1 = đổi) hoặc `Remoras` · `Approvals` (badge số việc đang chờ, lấy từ `api.approvals()` mỗi 30s, tận dụng polling hiện có) · `Funds` · `Memory`.
  - **Recents:** danh sách chat như cũ (tiêu đề nhóm đổi từ "Chats" thành "Recents").
  - **Chân sidebar:** `SetupChecklist` dạng gọn (chỉ khi onboarding chưa xong, có nút ✕ để ẩn), rồi `AccountMenu`.
  - **Bỏ khỏi nav:** Get started (thay bằng checklist), Verify, Settings, How it works và card kênh (vào `AccountMenu`), My memory (gộp vào Memory, D6).
- **Nghiệm thu:** ≤ 5 mục điều hướng trên Recents; ở 900px chiều cao, Recents hiện ít nhất 8 chat; chế độ thu gọn (icon) vẫn có tooltip cho từng mục.

#### B5 🟠 Chân sidebar chưa có menu tài khoản
- **File:** `app/wallet-account.tsx`, `app/wallet-avatar.tsx`
- **Sửa:** `AccountMenu`, mở bằng `DropdownMenu` phía trên:
  - **Trigger:** avatar + địa chỉ rút gọn + chevron.
  - **Đã sign in:** địa chỉ đầy đủ + Copy · Settings · Theme ▸ · Verify a receipt · How it works · Open in Telegram ↗ · Add to Discord ↗ · Sign out.
  - **Chưa sign in:** nút `Sign in` (primary, full-width trong sidebar) + menu ⋯ (Theme, How it works, kênh).
- **Nghiệm thu:** mọi link cũ trong sidebar vẫn tới được trong ≤ 2 cú bấm.

#### B6 🔴 Banner "Connect wallet to sign" to và hiện khắp nơi
- **File:** `features/remoras/hooks.tsx` (`RequireOwner`)
- **Bằng chứng:** card có viền + nút primary "Connect wallet to sign" ở mọi trang W2 khi session còn mà wallet chưa connect (tất cả `audit-*`). Trên mobile nó chiếm cả màn hình đầu.
- **Sửa:**
  - `RequireOwner` nhận prop `needsWallet?: boolean`, mặc định `false`;
  - chỉ các trang có ký mới bật: `/funds`, `/remoras/new`, `/remoras/:id`, `/approvals`, `/settings`;
  - banner thành `Alert` `warning` một dòng: "Reconnect your wallet to sign. Signed in as 0xd970…4757" + nút `outline` `sm` "Reconnect". Banner render trong `Page`, ngay dưới `PageHeader`.
- **Nghiệm thu:** `/remoras`, `/memory`, `/verify` không hiện banner; `w2.spec.ts:70` (`getByRole("button", { name: "Connect wallet to sign" })`) đổi sang "Reconnect" trong cùng commit.

#### B7 🔴 Title tab trình duyệt sai
- **Bằng chứng:**
  - `index.html`: "Remora — always-on agents with a leash on chain".
  - `chat-page.tsx`: `"hippo — the chatbot that remembers you, on memory you own"`.
  - `me-page.tsx`: `"My memory · hippo"`.
  - `guide-page.tsx`: `"How hippo works · memory on Walrus, owned on Sui"`.
  - `connect-page.tsx`: `PAGE_META[kind]`, cần kiểm lại chữ.
  - 9 trang Remora không đặt `document.title`, nên **giữ title của trang trước**. Đi từ chat sang Funds, tab vẫn ghi "hippo — …".
- **Sửa:**
  - `Page` nhận `title` và gọi `usePageMeta({ title: \`${title} · Remora\`, … })`; trang chủ là "Remora".
  - Trang có tên động (remora detail) dùng tên remora: "Scout · Remora".
  - Chat dùng tiêu đề thread: "Is 0x2 safe? · Remora".
  - Viết lại description của 4 `PAGE_META` hippo.
- **Nghiệm thu:** test mới trong `pages.test.tsx`: render từng route rồi `expect(document.title)` đúng mẫu; grep "hippo" trong `PAGE_META` = 0.

#### B8 🟢 Header title trùng với tiêu đề trang
- **Sửa:**
  - Header desktop hiện breadcrumb ngắn: "Remoras / Scout"; trang cấp một thì không hiện gì.
  - Header mobile hiện tên trang (vì `PageHeader` có thể bị cuộn mất).
  - `useShellTitle` giữ nguyên API, chỉ đổi cách hiển thị.
- **Nghiệm thu:** desktop không lặp chữ; mobile vẫn biết đang ở trang nào.

#### B9 🟠 Banner sai network của wallet dùng màu viết cứng
- **File:** `network-switch.tsx` (`WalletNetworkWarning`)
- **Sửa:** dùng `Alert` `warning`, đặt trong `Page` (không còn full-width dính header); nội dung giữ nguyên.

### C. "Không biết bắt đầu từ đâu"

#### C1 🔴 Trang chủ là chat của hippo, không nói Remora là gì
- **File:** `features/chat/chat-page.tsx`, `greeting-line.tsx`, `how-strip.tsx`, `examples.tsx`, `memory-panel*.ts(x)`
- **Bằng chứng:** `/` hiện lời chào serif "Oh, hello" / "Morning", dải "Tell it once → Sealed on Walrus → Remembered…", link kênh lặp lần nữa, 5 ví dụ của hippo ("I only use pnpm…", "Postgres runs on 5433…"), panel memory 320px mở sẵn với dòng "Facts hippo keeps land here." Người mới không thấy remora, Disc hay Funds ở đâu cả.
- **Sửa, phương án đề xuất (Q1):**
  - `/` thành **Home**:
    - (a) **chưa sign in hoặc chưa có remora:** hero một câu ("Always-on agents you own: memory you can read, a budget Sui enforces, a receipt for every action.") + `SetupChecklist` đầy đủ (C2) + một nút primary theo bước kế tiếp;
    - (b) **đã có remora:** dashboard (nội dung D1).
  - Chat chuyển sang `/chat`. `New chat` trong sidebar trỏ tới `/chat`. Danh sách Recents mở `/chat`.
  - Cần **contract PR** sửa `routes.tsx`. `requestNewChat` và `requestOpenChat` trong `app-layout.tsx` đang `navigate("/")`, cần đổi sang `/chat` (file của Huấn).
- **Phương án B** (nếu Q1 = giữ chat làm home): giữ `/`, nhưng thay greeting/how-strip bằng một thẻ "New here? Set up your first remora →" khi checklist chưa xong, đổi examples sang Remora, và đóng panel mặc định.
- **Nghiệm thu:** người mới vào `/` thấy ngay việc phải làm và chỉ có **một** nút primary; smoke `["/", /Tell it once/]` đổi theo phương án đã chốt.

#### C2 🔴 Onboarding: 5 card ngang hàng, bước sai, không tick được
- **File:** `features/onboarding/onboarding-page.tsx`
- **Bằng chứng:**
  - Bước "memory" chỉ là một link xem, không phải một bước thật.
  - Bước "fund" và "telegram" **không bao giờ được tick**: `doneOf` trả `false` cho cả hai.
  - Mỗi bước có link "Open" gạch chân 14px xám.
- **Sửa:** `SetupChecklist` dùng chung cho Home, `/onboarding` và chân sidebar:
  1. **Connect your wallet**: done khi `useOwner().owner` có giá trị. CTA là `WalletPicker` signIn.
  2. **Add USDC**: done khi address balance > 0; đọc từ `useFunds` (đã có). CTA "Add funds" dẫn sang `/funds`.
  3. **Create your first remora**: done khi `api.remoras()` có ít nhất một bản ghi. CTA "Create a remora" dẫn sang `/remoras/new`.
  4. *(Optional)* **Link Telegram**: done nếu API có trả trạng thái đã link (cần kiểm `api.settings()`; nếu không có thì để "Optional", không tick, và ghi handoff xin field).
  - Bước hiện tại nổi bật (viền primary + nút primary); bước xong có ✓ màu success và chữ muted; bước sau đó thì mờ.
- **Nghiệm thu:** 3 bước bắt buộc tick theo state thật; checklist ở sidebar tự ẩn khi đủ 3/3.

#### C3 🟠 Chat: control khó hiểu, thông tin lặp
- **File:** `chat/composer-shell.tsx`, `chat-page.tsx`, `how-strip.tsx`, `memory-strip.tsx`
- **Bằng chứng:**
  - `Switch` memory không có nhãn nhìn thấy được.
  - Meter "Gemini 2.5 Flash · 0 / 1M · 0% · $0.00" và dòng "0 of 0 on Walrus · guest · remembering" đều là chữ nhỏ xám.
  - Nút "+" luôn disabled.
  - Link Telegram/Discord xuất hiện 3 nơi.
- **Sửa:**
  - Switch → `Toggle` có icon 🧠 và nhãn "Memory" (trạng thái on/off rõ ràng), kèm tooltip.
  - Meter → nút `ghost` `icon-sm` ⓘ mở popover chứa model, context, giá và trạng thái Walrus.
  - Bỏ nút "+" khi không có `onAdd`.
  - Bỏ `HowStrip` (link kênh đã có trong `AccountMenu`).
  - Panel memory **mặc định đóng**; mở bằng nút `icon-sm` trên toolbar chat (thay nút "Open memory" `default` 36px).
  - Ví dụ gợi ý viết riêng cho Remora (Q7): "Ask Scout: is package 0x2 safe?" · "Teach Sentinel: ignore SUI under 0.01" · "What did my remoras do today?"
  - Cập nhật `pages.test.tsx` (các test "offers something to teach it…", "keeps the memory panel closed…").
- **Nghiệm thu:** toolbar composer chỉ còn: memory toggle · ⓘ · send; không còn link kênh trong chat.

### D. Từng trang

#### D1 🔴 `/remoras`: dashboard rời rạc
- **File:** `features/remoras/remoras-page.tsx`
- **Bằng chứng** (`audit-light-remoras.png`): dòng "0 remoras on this network." 14px xám + nút "New remora" + card "Your first remora" có link gạch chân + `h2` "Everything, newest first" + "Nothing yet." Ba khối cùng nói "chưa có gì".
- **Sửa** (wireframe §5.4):
  - `PageHeader`: tiêu đề "Remoras", mô tả "{n} on testnet", action `New remora` (primary).
  - Nếu có approval đang chờ: `Alert` gọn "2 approvals waiting" + nút "Review" dẫn sang `/approvals`.
  - **Rỗng:** một `EmptyState` duy nhất chứa 2 `TemplateCard` (Scout / Sentinel); bấm thẻ thì sang `/remoras/new?template=…`. Ẩn mục feed.
  - **Có remora:** lưới `RemoraCard`, 1 cột trên mobile và 2 cột từ `md`: tên, `StatusBadge`, template, thanh ngân sách (`Progress`, spent/limit), hoạt động gần nhất (`Time`).
  - `Section` "Activity" (bỏ chữ "Everything, newest first") chứa `FeedList` với `showRemora`.
- **Nghiệm thu:** trạng thái rỗng chỉ có 1 khối; giữ `data-testid="remora-card"` trên card.

#### D2 🟠 `/remoras/new`: wizard thô
- **File:** `features/remoras/new-remora-page.tsx`
- **Bằng chứng** (`audit-light-remoras-new.png`):
  - Template là `<button>` bọc `Card`, chọn bằng `ring-2`.
  - Câu giải thích chứa id kỹ thuật "reef:sui-risk, reef:odds, reef:brief".
  - Nút "Create Scout" nhỏ, nằm bên trái; trạng thái từng bước là chữ xám bên cạnh.
- **Sửa:**
  - `PageHeader` "New remora".
  - Bước 1, chọn template: `RadioGroup` dạng card (icon, tên, 1 câu, chip "Spends USDC" hoặc "Read-only"). Đọc `?template=` từ URL.
  - Bước 2, cấu hình: dùng `Field` cho Name; với Scout là Monthly limit và Max per payment, mỗi ô có hậu tố "USDC" và hint dưới ô. Payee hiện dạng chip có tên dễ đọc ("Sui risk check", "Odds", "Brief"); id gốc để trong tooltip. Với Sentinel là "Addresses to watch", hint "One per line".
  - Khối tóm tắt trước khi tạo: "You'll sign **1 transaction** to create its Disc" (Scout), hoặc "No signature needed" (Sentinel).
  - Footer: nút primary canh phải "Create Scout"; khi chạy, nút hiện spinner + `STEP_TEXT`. Lỗi hiện bằng `Alert`.
  - **Giữ nguyên:** label "Name", "Monthly limit (USDC)", "Most it pays at once (USDC)", "Addresses to watch" và `data-testid="create-step"` (E2E dùng). Template card vẫn phải có accessible name bắt đầu bằng tên template (`w2.spec.ts:82, 101` dùng `getByRole("button", { name: /^Scout/ })`). Nếu đổi sang radio thì sửa test thành `getByRole("radio", …)` trong cùng commit.
- **Nghiệm thu:** tạo Scout và Sentinel qua E2E `w2` vẫn pass; không còn `<button>` thô.

#### D3 🔴 `/remoras/:id`: 6 card dọc, nút phá huỷ không confirm
- **File:** `features/remoras/remora-page.tsx`
- **Bằng chứng:**
  - `Controls`: Go live, Pause/Resume, Rotate key, Edit, **Retire (`variant="destructive"`, bấm là chạy)** nằm chung một hàng.
  - Busy là một dòng chữ "Working… check your wallet." nằm cạnh.
  - Sau đó là Ask/Teach, Budget, Schedules, Sources, Activity, mỗi khối một card; thông tin key/Disc dạng "Key 0x1234…".
- **Sửa** (wireframe §5.5):
  - `PageHeader`:
    - tiêu đề: tên + `StatusBadge`;
    - mô tả: persona;
    - action: một nút primary theo trạng thái (shadow → "Go live"; active → "Pause" `outline`; paused → "Resume" primary), kèm menu ⋯ (Edit, Rotate key, Retire).
  - Nếu đang shadow: `Alert` (info) "Shadow mode: it shows what it would pay but pays nothing until {date}."
  - **Tabs** (`?tab=` trên URL):
    - **Overview:** Ask (Scout) hoặc Teach + Rules (Sentinel); `BudgetMeter` (thanh tiến độ, "0.42 of 1.00 USDC left this month", forecast); 5 hoạt động gần nhất + link "See all".
    - **Activity:** `FeedList` đầy đủ + link "Its memory" dẫn sang `/memory?remora=id`.
    - **Settings:** `Section` Identity (sửa name/persona, Save canh phải); `Section` Budget (Change budget + giải thích "revokes the old Disc and issues a new one", có confirm); `Section` Schedules (Scout); `Section` Sources (Scout, bảng); `Section` Keys (địa chỉ key và Disc dạng `Hash` có copy); **Danger zone** (Rotate key, Retire, mỗi nút qua `ConfirmAction`).
  - Retire confirm: "Retire Scout? Its Disc is revoked and it stops for good. Its memory stays yours." Rotate confirm: "Rotate Scout's key? The old key can't spend after this."
  - **Giữ nguyên:** label "Question", "Rule", nút "Ask", "Teach", "Go live", "Retire", list `aria-label="Rules"`, `data-testid` `answer`, `budget-meter`, `schedule-preview`, chữ trạng thái "active" và "retired" (E2E dùng). Retire giờ có thêm bước confirm, nên `w2.spec.ts:219` thêm click nút xác nhận.
- **Nghiệm thu:** trang không cuộn quá 1,5 màn hình ở tab Overview; Retire và Rotate luôn qua dialog; E2E `w2` pass.

#### D4 🟠 `/funds`: nút disabled vẫn nổi, nhãn kỹ thuật
- **File:** `features/funds/funds-page.tsx`, `disc-panel.tsx`
- **Bằng chứng** (`audit-dark-funds.png`, `testnet-funds-live.png`):
  - "Move $0.00 to address balance" là primary disabled nhưng vẫn mang màu teal.
  - Nhãn "In coins (0) → needs moving" có ký tự lạ.
  - "Last transaction Am9Bgn…" là link `text-xs` gạch chân.
  - "Advanced" là `ghost` `px-0`.
  - Signed-out dùng container `max-w-md p-8 text-center` riêng.
- **Sửa:**
  - `PageHeader` "Funds", mô tả "Remoras spend USDC from your address balance, only through their Disc.", action `Detect funds` (`outline`).
  - 2 `StatTile`:
    - "Ready to spend" + số tiền + tooltip ⓘ giải thích address balance;
    - "In coins": nếu > 0 thì tile viền warning + nút primary "Move $X to ready" ngay trong tile; nếu = 0 thì "✓ Nothing to move" màu success và **không có nút**.
  - "Settling…" dùng `Badge` `warning` có spinner.
  - Giao dịch cuối dùng `Hash` (mono, copy, link explorer).
  - `Section` "Budgets": danh sách Disc dùng `DiscRow` chung (tên, `StatusBadge`, `Progress` spent/cap, metadata, nút Pause/Resume `outline` `sm`).
  - Rỗng thì `EmptyState` "No budgets yet", CTA "Create a remora".
  - `Collapsible` "Advanced: withdraw to a coin" đặt cuối trang, trigger là `Button variant="ghost" size="sm"` có chevron xoay.
  - Signed-out dùng chung `RequireOwner` (bỏ nhánh riêng).
- **Giữ nguyên:** `data-testid` `ready`, `coins`, `disc-row`; label "Withdraw amount (USDC)"; nút "Withdraw to coin", "Resume"/"Pause"; regex `/Move \$[\d.]+ to address balance/` (`testnet.spec.ts`). Nếu đổi chữ nút Move thì sửa regex cùng commit.
- **Nghiệm thu:** khi coins = 0 không có nút primary nào bị disabled; E2E `testnet` pass.

#### D5 🟠 `/approvals`
- **File:** `features/approvals/approvals-page.tsx`
- **Bằng chứng** (`audit-light-approvals.png`): "Nothing is waiting for you." + nút ghost "Show decided" lạc ở góc phải. Card thanh toán: tiêu đề là tên remora + badge "pending"; số tiền nằm trong câu mô tả.
- **Sửa:**
  - `PageHeader` "Approvals"; ngay dưới là `Tabs` "Waiting (n)" / "Decided" (thay nút toggle `all`).
  - `ApprovalCard`:
    - dòng 1: tên remora + `Time`;
    - dòng 2: **số tiền lớn** (`text-2xl tabular-nums`) + "to {payee}";
    - dòng 3: lý do ("Over its 0.01 USDC per-payment cap") + câu hỏi gốc trong ngoặc kép;
    - footer: `Pay once (0.02 USDC)` (primary) + `Decline` (outline), cùng cỡ `default`; busy hiện trong nút.
  - Card "paid once": badge `success` "Paid", có `Hash` digest và câu trả lời.
  - Rỗng: `EmptyState` (icon Inbox) "You're all caught up", không có CTA.
- **Giữ nguyên:** `data-testid` `approval`, `approval-answer`; regex nút `/Pay once \(0\.02 USDC\)/`.
- **Nghiệm thu:** E2E `w2` (E4) pass.

#### D6 🔴 `/memory` + `/me`: hai trang, hai khái niệm, còn hippo
- **File:** `features/memory-inspector/memory-page.tsx`, `features/me/*`
- **Bằng chứng:**
  - `/me` (`audit-light-me.png`): badge "guest", "remembering", namespace `hippo-guest:…`, "Right now hippo keeps it under its own account", tile "Owned by **hippo, for now**", "Say something in the chat and hippo will start remembering you", nút "Own this memory".
  - `/memory` (`audit-light-memory.png`): khi không có remora, một dòng chữ dính trái; khi có thì `NativeSelect` + `Input` + một đoạn liệt kê namespace dài + bảng.
- **Sửa (Q5):** một mục **Memory**, `PageHeader` "Memory", `Tabs`:
  - **Remoras** (nội dung `/memory`):
    - toolbar gồm `Select` remora + ô tìm (icon 🔍, placeholder "Search what it remembers");
    - namespace hiện thành chip có số đếm (`sources · 12`);
    - cảnh báo index dùng `Alert` `warning`;
    - kết quả tìm là list có badge namespace;
    - bảng: blob (`Hash`), namespace, status (`StatusBadge`), stored/expires (`Time`), size (định dạng "1.2 KB");
    - rỗng: `EmptyState` "No remoras yet", CTA "Create a remora".
  - **Chat** (nội dung `/me`, đổi chữ): "hippo" thành "Remora"; "guest" thành "Not owned yet"; "Own this memory" giữ nguyên; các panel giữ nguyên chức năng (Changes, Chain, Export, Import, Wallet read, Claude Code) nhưng xếp thành `Section` và bỏ lưới 2 cột lệch.
  - Nút "Sign out" chuyển vào `AccountMenu` (B5).
  - Route: `/memory?tab=chat`; `/me` redirect sang đó (contract PR `routes.tsx`, đi chung với C1).
- **Nghiệm thu:** không còn chữ "hippo" hiển thị; một mục Memory trong sidebar; smoke `/memory` pass; các test `me` trong `pages.test.tsx` được cập nhật.

#### D7 🟠 `/settings`
- **File:** `features/settings/settings-page.tsx`
- **Bằng chứng** (`audit-light-settings.png`):
  - 3 card.
  - Save rộng nửa card.
  - Timezone là input tự do ("UTC").
  - Notifications dùng `NativeSelect` có câu dài "Only urgent ones live; the rest in the feed".
  - Panic là nút `destructive` đỏ to, không confirm.
  - Có **2 cơ chế panic khác nhau** (E1).
- **Sửa:**
  - `PageHeader` "Settings".
  - `Section` **Notifications**:
    - Timezone dùng `Combobox` (từ `Intl.supportedValuesOf("timeZone")`, mặc định là timezone của trình duyệt);
    - Quiet hours là 2 `Input type=time` nằm cùng hàng ("from … to …");
    - Language dùng `Select`;
    - "How loud" là `RadioGroup` 3 lựa chọn, mỗi lựa chọn có tiêu đề ngắn và mô tả ("All pings" / "Urgent only" / "Digest only");
    - Save canh phải, disabled khi không có thay đổi, hiện "Saved" sau khi lưu.
  - `Section` **Telegram**: trạng thái (Linked hoặc Not linked) + nút `outline` "Link Telegram"; mã link dùng `Hash` có copy + đếm ngược phút.
  - `Section` **Danger zone** (viền destructive nhạt): "Pause everything" là nút `outline` chữ đỏ, qua `ConfirmAction`.
- **Nghiệm thu:** Save không còn rộng nửa card; panic cần xác nhận.

#### D8 🟠 `/verify`
- **File:** `features/verify/verify-page.tsx`
- **Bằng chứng** (`audit-light-verify.png`): chỉ có 1 input + nút, không có tiêu đề hay giải thích. Kết quả dùng `text-emerald-600`.
- **Sửa:**
  - `PageHeader` "Verify a receipt", mô tả "Paste a transaction digest or a Wake id. We check it against Sui through Tatum; no sign-in needed."
  - Form: input lớn (`h-10`) + nút primary.
  - Kết quả: một card verdict (icon lớn + "Verified" màu success hoặc "Doesn't check out" màu destructive + badge anchored); danh sách check dùng icon success/destructive/muted; `WakeDetails` đặt trong `Section` "Receipt".
  - Trạng thái trống: 3 dòng giải thích "What we check" (intent hash, Paid anchor, payee balance, signer).
- **Giữ nguyên:** `data-testid="verify-verdict"`, regex smoke `/Check|Verify/`.
- **Nghiệm thu:** không còn màu viết cứng; trang rỗng vẫn có nội dung giải thích.

#### D9 🔴 `/guide`: toàn bộ là hippo
- **File:** `features/guide/guide-page.tsx`, `guide-content.ts`, `guide-visuals.tsx`
- **Bằng chứng** (`audit-light-guide.png`): "A chatbot that remembers you, on memory you own", "hippo keeps the facts…", `ask-hippo.vercel.app`, `@walrussession8_bot`, "hippo keeps the fact", namespace "hippo".
- **Sửa (Q4):**
  - **Ngay:** ẩn khỏi nav (Phase 2), giữ route.
  - **Cuối Phase 3:** viết lại thành "How Remora works" gồm 4 khối:
    1. *A remora* (key, memory, budget, triggers);
    2. *Memory you can read* (Walrus Memory, namespaces, export);
    3. *A budget Sui enforces* (Disc, allowance, pause/revoke);
    4. *A receipt for every action* (Wake, Why?, Verify).
  - Mỗi khối gồm 1 hình (tái dùng `guide-visuals`), 1–2 câu và 1 link sang trang thật. Phần "Same memory in Claude Code" giữ lại và đổi namespace.
- **Nghiệm thu:** grep "hippo" (không phân biệt hoa thường) trong `features/guide` = 0.

#### D10 🟠 Chữ "hippo" còn sót trên web
- **Bằng chứng:**
  - `chat-page.tsx` `PAGE_META`
  - "Facts hippo keeps land here." (memory panel)
  - `examples.tsx`: comment và key `hippo.pendingAsk`
  - `use-memory-panel.ts`: `hippo.memory-panel`
  - `active-chat.ts`: `hippo.activeChat`
  - các test trong `pages.test.tsx` có chuỗi hippo
- **Sửa:**
  - đổi mọi chữ hiển thị;
  - key storage đổi sang `remora.*` kèm migrate: đọc key cũ một lần, ghi sang key mới, xoá key cũ; viết trong một helper `lib/storage.ts`, có try/catch;
  - **handoff cho Uy:** "Sign in to hippo" và tên cookie trong `apps/server/src/routes/auth.ts`.
- **Nghiệm thu:** `grep -rni "hippo" apps/web/src --include=*.tsx --include=*.ts | grep -v test | grep -v "storage.ts"` chỉ còn comment lịch sử (hoặc = 0).

#### D11 🟠 Mobile
- **Bằng chứng:**
  - Header 390px chật (tiêu đề cắt, badge + 2 toggle + theme).
  - Signed-out W2 hiện nút primary full-width.
  - Funds tile 2 cột thành 1 cột ổn; chưa kiểm Remora detail và Memory table trên mobile.
- **Sửa:**
  - B1 + B3 giải phóng header (còn: ☰ · tiêu đề · network chấm + chữ ngắn "Test" · ⏸).
  - Bảng Memory trên mobile thành list card (blob + namespace + expires).
  - Tabs remora cuộn ngang được.
  - Dialog confirm full-width trên mobile (`sm:max-w-md`).
- **Nghiệm thu:** smoke `mobile` pass (không có scroll ngang); chụp 5 trang chính ở 390px.

#### D12 🟢 Not found và connect
- **File:** `app/not-found.tsx`, `features/connect/connect-page.tsx`
- **Sửa:**
  - Not found dùng `EmptyState` + 2 nút ("Go home", "Open chat").
  - Connect/Disconnect dùng `Page width="narrow"` + `PageHeader`; giữ nguyên luồng.

### E. Lỗi nhất quán (không chỉ là giao diện)

#### E1 🔴 Có hai "panic" khác nhau
- **Bằng chứng:**
  - Header `PanicButton` gọi `buildPause(cfg, liveDiscIds, true)`: client tự dựng PTB, **chỉ pause Disc**.
  - Settings `Panic` gọi `api.panic()` + `api.panicConfirm()`: server dựng giao dịch, **pause cả remora lẫn Disc** (toast "Paused N remoras").
  - Cùng tên, khác tác dụng.
- **Sửa:** cả hai nút gọi **một** hook `usePanic()` dùng đường server (`api.panic` + confirm), vì nó bao trùm hơn và đúng spec N10 ("Pause every remora and Disc"). `ConfirmAction` hiện số remora và số Disc sẽ bị pause.
- **Rủi ro:** `testnet.spec.ts` đang kiểm "Paused N Disc" (`/Paused \d+ Disc/`) sau khi pause từ header. Phải đổi kỳ vọng sang câu mới. **Nếu `api.panic` không pause Disc của ví burner** (Disc do global setup tạo, không gắn remora), test sẽ sai, nên cần kiểm trước khi sửa; xem Q8.
- **Nghiệm thu:** một hook, một câu toast; E2E `testnet` pass.

#### E2 🟠 Onboarding tick sai (đã ghi ở C2)

#### E3 🟠 Hai màu teal khác nhau
- **Bằng chứng:** `--brand: oklch(0.6 0.118 184.7)` (7 file dùng `text-brand`/`bg-brand`) khác `--primary: oklch(0.42 0.08 205)`. Card kênh, how-strip và stat-strip dùng brand; nút dùng primary.
- **Sửa:** gộp `brand` vào `primary` (§2.1); thay 7 file.
- **Nghiệm thu:** `grep -rn "brand" apps/web/src --include=*.tsx | grep -v test` = 0.

#### E4 🟢 Badge trạng thái không thống nhất
- **Bằng chứng:**
  - `remoras-page.tsx`: `STATUS` map (active = `default`, paused = `destructive`…).
  - `remora-page.tsx`: tự tính (`paused` → destructive, còn lại secondary).
  - `disc-panel.tsx`: live = secondary, paused = destructive.
  - feed: blocked/ping = destructive.
- **Sửa:** `StatusBadge` duy nhất (§4).

### F. Accessibility (N18, làm cùng các phase)

- **F1:** mọi nút icon có `aria-label` + `Tooltip`; nút 👍/👎 có trạng thái `aria-pressed`.
- **F2:** `Tabs`, `RadioGroup`, `DropdownMenu` dùng primitive của kit (Radix/Base UI) để có bàn phím sẵn.
- **F3:** focus ring luôn thấy được ở cả 2 theme (`--ring` mới).
- **F4:** `prefers-reduced-motion`: tắt animation của greeting và chevron.
- **F5:** chữ trên `primary` đạt AA (kiểm ở cả 2 theme).

---

## 4. Component spec

Đặt trong `apps/web/src/components/app/`. `components/ui` là kit shadcn, chỉ chỉnh khi cần variant, và ghi rõ trong commit.

| Component | Props | Hành vi | Thay cho |
|---|---|---|---|
| `Page` | `title: string`, `width?: "narrow" \| "default" \| "wide"`, `children` | container (§2.5), padding (§2.3), `overflow-y-auto`, gọi `usePageMeta` (B7) và `useShellTitle` | wrapper `div` ở mọi `*-page.tsx` |
| `PageHeader` | `title`, `description?`, `actions?: ReactNode`, `badge?: ReactNode` | `h1` theo §2.2; actions canh phải, xuống dòng trên mobile | chữ đầu trang rời rạc |
| `Section` | `title`, `description?`, `actions?`, `tone?: "default" \| "danger"` | `h2` 16px + nội dung; `danger` có viền destructive nhạt | `Card` bọc nhóm form |
| `EmptyState` | `icon`, `title`, `description`, `action?` | bọc `ui/empty` | "Nothing yet." |
| `StatTile` | `label`, `value`, `hint?`, `tone?`, `action?`, `data-testid?` | nhãn 12px + số 30px + hint | tile ở Funds, stat-strip ở Me |
| `StatusBadge` | `status: "creating" \| "shadow" \| "active" \| "paused" \| "retired" \| "live" \| "pending" \| "paid" \| "verified" \| "failed"` | map một chỗ: active/live/paid/verified = success; shadow/pending/creating = warning; paused/retired = outline muted; failed = destructive. Chữ hiển thị **giữ nguyên** giá trị status (E2E kiểm "active", "retired") | 4 cách map hiện tại |
| `ConfirmAction` | `trigger`, `title`, `description`, `confirmLabel`, `onConfirm: () => Promise<void>`, `tone?: "danger"` | `AlertDialog`; nút confirm có spinner khi chạy; Esc/hủy đóng được; lỗi hiện ngay trong dialog | Retire, Rotate, Pause all, Panic, Change budget |
| `NetworkSelect` | (không có) | dùng `useNetworks`; xem B1 | `NetworkSwitch` |
| `AccountMenu` | (không có) | xem B5; chứa `ThemeChoice` | `WalletAccount`, `ThemeToggle`, `ChannelsCard` |
| `ThemeChoice` | (không có) | radio Light/Dark/System trong menu | `ThemeToggle` |
| `SetupChecklist` | `variant: "full" \| "compact"` | xem C2; `compact` có nút ✕ (lưu `remora.setup-dismissed`) | `OnboardingPage`, `ChannelsCard` |
| `Hash` | (đã có `components/hash.tsx`) | rà lại: mono 12px + copy + link tuỳ chọn | `slice(0,10)…` rải rác |
| `Time` | `value: string \| Date` | "2h ago" + tooltip đầy đủ, `<time dateTime>` | `toLocaleString()` |
| `BudgetMeter` | `meter`, `budget` | `Progress` + "X of Y left this month" + forecast | `<p data-testid="budget-meter">` (giữ test id) |
| `RemoraCard`, `TemplateCard`, `DiscRow`, `ApprovalCard` | theo dữ liệu | dùng lại ở nhiều trang | markup lặp |

Kit cần chỉnh (ghi rõ trong ADR-0036):

- `ui/card.tsx`: bỏ `shadow-sm`, đổi `gap-6 py-6` thành `gap-4 py-5`.
- `ui/badge.tsx` và `ui/alert.tsx`: thêm variant `success`, `warning`.
- `ui/button.tsx`: không đổi kích thước (giữ API); chỉ sửa variant `destructive` ở dark để bớt chói.

---

## 5. Wireframe (ASCII, desktop 1440px)

### 5.1 Header

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Remoras / Scout                                   [● Testnet ▾]  [⏸]    │
└──────────────────────────────────────────────────────────────────────────────┘
  ≡ = thu/mở sidebar · ● cam = testnet · ⏸ = Pause all (ghost, muted, đỏ khi hover)
```

### 5.2 Sidebar

```
┌────────────────────────┐
│ 🐟 remora              │
│                        │
│ ✎  New chat            │
│ ⌂  Home / Remoras      │
│ ⧉  Approvals       (2) │
│ $  Funds               │
│ 🧠 Memory              │
│                        │
│ Recents                │
│ 🔍 Search chats        │
│   Is 0x2 safe?         │
│   Odds this weekend    │
│   …                    │
│                        │
│ ┌────────────────────┐ │  ← chỉ khi setup chưa xong
│ │ Set up  ●●○  2/3 ✕ │ │
│ │ Next: Create remora│ │
│ └────────────────────┘ │
│ (◉) 0xd970…4757     ⌃  │  ← AccountMenu
└────────────────────────┘
```

AccountMenu:

```
┌──────────────────────────┐
│ 0xd9703e0…17f634757  ⧉   │
│──────────────────────────│
│ ⚙  Settings              │
│ ◐  Theme              ▸  │ → Light · Dark · System
│ ✓  Verify a receipt      │
│ ?  How it works          │
│──────────────────────────│
│ ↗  Open in Telegram      │
│ ↗  Add to Discord        │
│──────────────────────────│
│ ⎋  Sign out              │
└──────────────────────────┘
```

### 5.3 Home (Q1, khi chưa có remora)

```
          Always-on agents you own.
          Memory you can read · a budget Sui enforces · a receipt for every action.

          ┌──────────────────────────────────────────────┐
          │ ✓  Connect your wallet           0xd970…4757 │
          │ ●  Add USDC                      [Add funds] │  ← bước hiện tại
          │ ○  Create your first remora                  │
          │ ○  Link Telegram (optional)                  │
          └──────────────────────────────────────────────┘
```

### 5.4 `/remoras` (có dữ liệu)

```
Remoras                                              [+ New remora]
2 on testnet

┌ ⚠ 2 approvals waiting ─────────────────────────────── [Review] ┐

┌─────────────────────────┐  ┌─────────────────────────┐
│ Scout        ● active   │  │ Sentinel     ● shadow   │
│ Scout · buys answers    │  │ Sentinel · watches      │
│ ▓▓▓▓░░░░ 0.42 / 1 USDC  │  │ Read-only               │
│ Paid sui-risk · 2h ago  │  │ Ignored 0.001 SUI · 5m  │
└─────────────────────────┘  └─────────────────────────┘

Activity
 paid    Scout · Paid 0.01 USDC to Sui risk check      2h   👍 👎  Why?
 learned Sentinel · Ignore incoming SUI under 0.01     5m          Why?
```

### 5.5 `/remoras/:id`

```
Remoras / Scout
Scout  ● shadow                                        [Go live]  [⋯]
Answers questions by buying the best data…

┌ ℹ Shadow mode: it shows what it would pay, but pays nothing until Nov 4 ┐

[ Overview ]  Activity   Settings
─────────────────────────────────────────────────────────────────────
Ask Scout
┌───────────────────────────────────────────────────────────────┐
│ Is package 0x2 safe to depend on?                             │
└───────────────────────────────────────────────────────── [Ask]┘

Budget                                   0.58 of 1.00 USDC left this month
▓▓▓▓▓▓░░░░░░  · at this pace it runs out on Nov 20

Recent activity                                                See all →
 …
```

Tab Settings: Identity · Budget · Schedules · Sources · Keys · **Danger zone** (Rotate key, Retire).

### 5.6 `/funds`

```
Funds                                                   [Detect funds]
Remoras spend USDC from your address balance, only through their Disc.

┌ Ready to spend ⓘ ─────────┐  ┌ In coins ────────────────────┐
│ $1.70                     │  │ ✓ Nothing to move            │
└───────────────────────────┘  └──────────────────────────────┘
Last transaction  Am9Bgn2i…  ⧉ ↗

Budgets
 e2e-burner  ● live   ▓░░░░ 0.00 / 0.10 USDC · ≤0.01 a payment · 1 payee · until Nov 18  [Pause]

▸ Advanced: withdraw to a coin
```

---

## 6. Kế hoạch triển khai (task có checkbox)

Mỗi task ghi: file · việc · nghiệm thu. Mỗi phase là một hoặc nhiều commit trên `main`. **Chỉ bắt đầu một phase khi bạn ghi "OK Phase N".**

### Phase 0: Quyết định và chuẩn bị (không đổi UI)
- [x] Chốt Q1–Q8 (§10).
- [x] Viết ADR-0036 (UI foundation), ADR-0037 (network dropdown) và ADR-0038 (Home/chat/Memory), thêm dòng vào `docs/adr/README.md`; cập nhật `docs/ux/README.md` (bỏ mô tả badge TESTNET và nút Pause all đỏ).
- [x] Nếu Q1 hoặc Q5 = đổi route: mở **contract PR** `routes.tsx` (thêm `/chat`; `/` = Home; `/me` → redirect `/memory?tab=chat`); đã sửa trong working tree, chờ Uy duyệt (xem progress log).
- [x] Baseline: giữ local theo Q9 (không commit ảnh "trước").

### Phase 1: Nền tảng (A1–A9, E3, E4). Commit `[H4·ui] UI foundation: warm theme, page components (ADR-0036)`
- [x] `index.css`: token mới §2.1, `--success`/`--warning`, gộp `--brand` vào `--primary`, sidebar token; `index.html` đổi theme-color.
- [x] `ui/card.tsx`, `ui/badge.tsx`, `ui/alert.tsx`: chỉnh như §4.
- [x] Tạo `components/app/`: `Page`, `PageHeader`, `Section`, `EmptyState`, `StatTile`, `StatusBadge`, `ConfirmAction`, `Time`, `BudgetMeter`; rà lại `Hash`.
- [x] Unit test cho `StatusBadge` (map), `Time` (định dạng), `Page` (đặt `document.title`), `ConfirmAction`.
- [x] Thay màu viết cứng và hex (A2); thay 7 file `brand` (E3).
- [x] **Nghiệm thu:** grep sạch A2/E3; `typecheck`, `lint`, `test` xanh; smoke và mobile xanh. Lúc này UI chỉ đổi màu, bố cục chưa đổi.

### Phase 2: Khung app (B1–B9, E1, D10). Commit `[A9·ui·N10·ui·H4·ui] Compact shell: network dropdown, account menu, quiet panic (ADR-0037)`
- [x] `NetworkSelect` thay `NetworkSwitch`; giữ `testnet-badge` trên trigger; sửa test smoke "mainnet is offered but disabled" (`radio` → `menuitemradio` disabled).
- [x] `usePanic()` dùng chung (E1); `PanicButton` thành icon + `ConfirmAction`, luôn hiện khi đã sign in; sửa `testnet.spec.ts` (thêm click confirm, câu toast mới).
- [x] `AccountMenu` + `ThemeChoice` (thêm System); bỏ `ThemeToggle` khỏi header; cập nhật script chống nháy trong `index.html`; sửa `pages.test.tsx:461`.
- [x] `app-sidebar.tsx`: 5 mục + Recents + `SetupChecklist compact`; bỏ `ChannelsCard` khỏi footer (chuyển link vào menu); badge Approvals.
- [x] `RequireOwner`: thêm `needsWallet`, banner gọn (B6); sửa `w2.spec.ts:70` sang "Reconnect".
- [x] Header breadcrumb (B8); `WalletNetworkWarning` thành `Alert` (B9).
- [x] Title: mọi trang gọi `Page title` (tạm thời bọc trang cũ) và sửa 4 `PAGE_META` (B7); thêm test title.
- [x] Chữ hippo + migrate key storage (D10); viết handoff `docs/handoffs/2026-10-xx-huan-to-uy-hippo-auth-strings.md`.
- [x] **Nghiệm thu:** header 3 control cao 32px; sidebar ≤ 5 mục; E2E `smoke`, `mobile`, `testnet` xanh.

### Phase 3: Từng trang, theo luồng demo. Mỗi trang một commit
1. [x] **Home + onboarding** (C1, C2): `SetupChecklist full`, Home theo Q1; sửa smoke `/` và `/onboarding`. Commit `[A6·H4·ui] Home and setup checklist`.
2. [x] **`/remoras`** (D1): `RemoraCard`, `TemplateCard`, `EmptyState`. Commit `[H4·ui] Remoras dashboard`.
3. [x] **`/remoras/new`** (D2): `RadioGroup` template, `Field`, tóm tắt chữ ký; sửa selector `w2` nếu đổi role. Commit `[B1·ui] Create wizard`.
4. [x] **`/remoras/:id`** (D3): header + menu ⋯, Tabs, `BudgetMeter`, Danger zone + `ConfirmAction`; sửa `w2.spec.ts:219` (Retire confirm), kiểm "Go live", "Ask", "Teach". Commit `[H4·ui·B8·ui·B9·ui] Remora page tabs and danger zone`.
5. [x] **`/funds`** (D4): `StatTile`, `DiscRow`, ẩn nút Move khi 0, Advanced xuống cuối. Commit `[A4·ui] Funds layout`.
6. [x] **`/approvals`** (D5): Tabs, `ApprovalCard`. Commit `[N2·ui·E4·ui] Approvals inbox`.
7. [x] **Memory** (D6): Tabs Remoras/Chat, đổi chữ trang `/me`, bảng hoặc list trên mobile. Commit `[F3·ui] Memory: one place, two tabs`.
8. [x] **`/settings`** (D7): Sections, timezone combobox, radio "How loud", Danger zone. Commit `[A7·ui·H5·ui·N10·ui] Settings sections`.
9. [x] **`/verify`** (D8). Commit `[G3·ui] Verify page`.
10. [x] **Chat** (C3): toolbar composer, panel đóng mặc định, examples Remora, bỏ how-strip; sửa các test chat. Commit `[H4·ui] Chat composer and empty state`.
11. [x] **Guide** (D9): viết lại nội dung, đưa lại vào AccountMenu. Commit `[N14] How Remora works`.
12. [x] **Not found + connect** (D12).
- **Nghiệm thu mỗi trang:** dùng `Page` + `PageHeader`; không có `<button>` thô; không có màu viết cứng; trạng thái rỗng, lỗi và loading theo §2.6; chụp light + dark + mobile; E2E liên quan xanh.

### Phase 4: Rà soát cuối (D11, F1–F5)
- [x] Pass mobile 390px cho tất cả trang (bảng Memory thành list, tabs cuộn ngang, dialog full-width).
- [x] Pass dark mode: tương phản, focus ring, hover (bộ `audit-dark-*`).
- [x] Pass bàn phím: primitive của kit (Radix/Base UI) cho Tabs, RadioGroup, DropdownMenu, AlertDialog; Esc đóng, Enter submit; nút icon có aria-label + tooltip, 👍/👎 có aria-pressed.
- [x] Chạy toàn bộ E2E (`smoke`, `mobile`, `testnet`, `w2`) và `audit`.
- [x] Bộ ảnh sau khi sửa vào `docs/e2e/screenshots/` (smoke, mobile, audit light/dark, testnet); cập nhật bảng ảnh trong `docs/e2e/README.md`.
- [x] Handoff `docs/handoffs/…-huan-to-uy-ui-polish-landed.md`: các thay đổi ảnh hưởng tới video demo (route, vị trí nút, bước confirm mới).
- [x] Đánh dấu "Done khi" ở §7.4.

---

## 7. Kế hoạch test

### 7.1 Unit (`vitest`, `apps/web`)

| File | Thay đổi |
|---|---|
| `app/pages.test.tsx` | sửa test theme toggle (dòng ~461), các test chat có chuỗi hippo, "offers something to teach it…" (examples mới), "keeps the memory panel closed…" (mặc định đóng), "filters the chat list in the sidebar" (nhóm Recents); thêm test `document.title` cho từng route; thêm test sidebar có ≤ 5 mục |
| `features/remora-pages.test.tsx` | cập nhật theo Tabs, menu ⋯, `ConfirmAction` |
| mới: `components/app/*.test.tsx` | `StatusBadge`, `Time`, `Page`, `ConfirmAction` (confirm và cancel) |
| mới: `lib/storage.test.ts` | migrate key `hippo.*` → `remora.*` |

### 7.2 E2E: selector bị ảnh hưởng

| Test | Hiện tại | Sau khi sửa |
|---|---|---|
| `smoke.spec.ts` PAGES `/` | `/Tell it once/` | theo Q1: chữ hero của Home, hoặc chữ empty chat mới |
| `smoke.spec.ts` | `getByTestId("testnet-badge")` | giữ test id trên trigger `NetworkSelect` |
| `smoke.spec.ts` "mainnet…disabled" | `getByRole("radio", { name: "mainnet" })` | mở dropdown → `getByRole("menuitemradio", { name: /Mainnet/ })` disabled |
| `smoke.spec.ts` | các câu "Sign in with your wallet to see …" | giữ nguyên chữ (đã nằm trong `RequireOwner`) |
| `testnet.spec.ts` | `getByRole("button", { name: "Pause all spending" })` → toast `/Paused \d+ Disc/` | thêm click nút confirm; toast theo E1 (Q8) |
| `testnet.spec.ts` | regex `/Move \$[\d.]+ to address balance/` | giữ, hoặc đổi regex theo chữ mới |
| `w2.spec.ts:70` | "Connect wallet to sign" | "Reconnect" |
| `w2.spec.ts:82,101` | `getByRole("button", { name: /^Scout/ })` | `getByRole("radio", { name: /^Scout/ })` nếu dùng `RadioGroup` |
| `w2.spec.ts:219` | click "Retire" | click menu ⋯ hoặc tab Settings → "Retire" → confirm "Retire" |
| `w2.spec.ts` | "Go live", "Ask", "Teach", label "Question"/"Rule", `answer`, `approval`, `verify-verdict` | giữ nguyên |
| `support/test-wallet.ts` `connectAndSignIn` | click "Connect wallet" đầu tiên (nằm trong sidebar) | trên mobile sidebar bị ẩn: dùng nút "Sign in" trong trang; thêm nhánh cho project `mobile` |

### 7.3 Kiểm thủ công mỗi phase

- 11 trang × (light, dark) × (1440px, 390px), ở hai trạng thái chưa sign in và đã sign in.
- Bàn phím: Tab, Esc, Enter. Đọc thử bằng VoiceOver ở trang Funds và Remora detail.
- So sánh ảnh trước và sau.

### 7.4 Done khi (toàn bộ plan)

- [x] Grep = 0 (ngoài `components/ui` và test):
  - `<button`
  - `(bg|text|border)-(amber|green|emerald|red|yellow|blue|sky|orange|rose)-\d`
  - `#[0-9A-Fa-f]{6}`
  - `text-\[\d+px\]`
  - `brand`
  - chữ "hippo" hiển thị — còn: 3 hằng số migrate `hippo.*` (cố ý, `lib/storage.ts` và 3 caller), URL skill upstream `…/hippo-memory/SKILL.md` (chờ Uy đổi tên), field `isHippo` từ server, key protocol `hippo.session`/`hippo.guest` trong `lib/api.ts` (file hợp đồng), và comment lịch sử. Không còn chuỗi hiển thị.
- [x] Mọi route dùng `Page` + `PageHeader`; mỗi trang có một `h1`; `document.title` = `"{Page} · Remora"` (chat là trang đặc thù, không dùng `Page`; `/me` redirect sang Memory).
- [x] Header có đúng 3 control (≡, network, pause), mỗi cái cao 32px; không có badge; không nhảy layout.
- [x] Sidebar có ≤ 5 mục trên Recents; có AccountMenu với Theme Light/Dark/System.
- [x] Mọi hành động phá huỷ qua `ConfirmAction`; chỉ còn một cơ chế panic.
- [x] `bun run typecheck && bun run lint && bun run test` xanh; E2E `smoke`, `mobile`, `testnet`, `w2` xanh.
- [ ] Bộ ảnh sau khi sửa được Huấn duyệt (đang chờ Huấn).

---

## 8. Rủi ro và cách giảm

| Rủi ro | Ảnh hưởng | Giảm |
|---|---|---|
| Đổi route (Q1/Q5) cần Uy duyệt contract PR | chặn Phase 3.1 và 3.7 | Phase 1–2 không phụ thuộc; nếu PR chậm thì làm phương án B của C1 trước |
| Gộp panic (E1) đổi hành vi: `api.panic` có thể không pause Disc "mồ côi" (Disc của burner không gắn remora) | E2E `testnet` đỏ; người dùng tưởng đã dừng hết | kiểm `api.panic` trước (đọc route server, chỉ đọc); nếu không bao trùm thì giữ client `buildPause` cho Disc + server cho remora trong cùng `usePanic` (Q8) |
| E2E dùng nhiều label/test id | đỏ hàng loạt | §7.2 liệt kê đủ; giữ test id; sửa test trong cùng commit |
| Đổi token màu làm lệch các component kit dùng `--sidebar-*`, `--chart-*` | màu lạ ở chỗ ít dùng | chụp toàn bộ sau Phase 1; grep biến CSS không dùng |
| Video demo quay ngày 7/11 dựa trên UI | Uy phải biết vị trí nút mới | handoff ở Phase 4; freeze UI trước 6/11 21:00 |
| Phạm vi lớn | trễ W3 | làm theo luồng demo; mục 🟢 có thể cắt |

---

## 9. Ngoài phạm vi (không làm trong plan này)

- Logo hay mark mới (vẫn là cá placeholder). Có thể làm riêng sau.
- i18n tiếng Việt cho UI.
- Tính năng mới: ⌘K (N7), health badges (N8), cost card (N15), Hatchery UI. Các tính năng này sẽ **dùng** component của plan này khi tới lượt.
- Copy cho bot Telegram (`apps/server/src/copy/`): làm ở một plan riêng, cùng giọng văn §2.7.
- Mọi thay đổi backend, API hay schema.

---

## 10. Câu hỏi cần bạn chốt

| # | Câu hỏi | Đề xuất | Ảnh hưởng nếu chọn khác |
|---|---|---|---|
| **Q1** | `/` là **Home/Dashboard** (chat chuyển sang `/chat`), hay giữ chat làm trang chủ? | **Home/Dashboard**: người mới bắt đầu từ remora; luồng demo cũng vậy. Cần contract PR | Giữ chat: làm phương án B của C1; không cần PR |
| **Q2** | Giữ màu nhấn **teal** (dịu lại) hay đổi màu? | Giữ teal | Đổi màu thì phải đổi logo và favicon |
| **Q3** | "Pause all" giữ trên header (icon nhỏ + confirm) hay chỉ trong Funds/Settings? | Giữ trên header (N10: "from anywhere") | Bỏ khỏi header thì header còn 2 control |
| **Q4** | Guide: ẩn trước, viết lại cuối Phase 3? | Đúng vậy | Viết lại ngay thì Phase 2 dài hơn |
| **Q5** | Gộp `/memory` + `/me` thành Memory có 2 tab? | Gộp (cần contract PR, đi chung Q1) | Giữ 2 trang: chỉ đổi tên "My memory" thành "Chat memory" |
| **Q6** | Font serif ở hero: giữ cho Home hay bỏ hẳn? | Bỏ hẳn, toàn bộ dùng sans cho đồng nhất | Giữ: chỉ ở 1 dòng hero |
| **Q7** | Ví dụ gợi ý trong chat: viết theo Remora (Scout/Sentinel)? | Có | Giữ ví dụ hippo |
| **Q8** | Panic: một cơ chế (server `api.panic`) cho cả header và Settings? | Có, sau khi kiểm nó pause cả Disc mồ côi | Giữ 2 cơ chế: đổi tên cho khác nhau ("Pause all Discs" / "Pause everything") |
| **Q9** | Ảnh "trước" có commit vào `docs/ux/before/` không? | Không, chỉ giữ local (ảnh nặng, đã có ảnh "sau" trong `docs/e2e/screenshots/`) | Commit: thêm khoảng 2–4 MB |

---

## 11. Phụ lục: số liệu baseline (2026-10-19)

Đo bằng grep trên `apps/web/src`, không tính `components/ui` và test.

| Chỉ số | Giá trị |
|---|---|
| `text-sm` / `text-xs` / `text-base` / `text-lg` / `text-xl` / `text-2xl` / `text-[11px]` | 135 / 29 / 12 / 3 / 4 / 3 / 1 |
| `<Button>` / `<button>` thô | 81 / 4 (`chat/recalled`, `chat/examples`, `chat/follow-up-row`, `remoras/new-remora-page`) |
| `size=` của Button | `sm` 25 · `icon` 10 · `icon-sm` 6 · (còn lại `default`) |
| Màu palette viết cứng | 13 chỗ / 5 file |
| Hex | 3 chỗ (`chat-turn`, `composer-shell`, `slash-menu-panel`) |
| File dùng `brand` | 7 |
| Các mức `max-w` ở wrapper trang | `md`, `xl`, `2xl`, `3xl`, `4xl`, `5xl` |
| Trang không đặt `document.title` | 9 (onboarding, funds, remoras, remoras/new, remoras/:id, memory, approvals, settings, verify) |
| Mục điều hướng trong sidebar | 10 (+ New chat) |
| Chữ "hippo" hiển thị trên web | chat (meta, panel), me (≥ 5 chỗ), guide (≥ 10 chỗ) |
| E2E | smoke 10/10 xanh (đã chạy 2026-10-19) |

**Ảnh tham chiếu** (local, gitignored, nằm trong `e2e/screenshots/`):

- light, đã sign in: `audit-light-{home,onboarding,remoras,remoras-new,funds,memory,approvals,settings,verify,me,guide}.png`
- dark, đã sign in: `audit-dark-…` cùng bộ trang
- chưa sign in: `smoke-*.png`
