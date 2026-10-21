import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Download } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Board } from '../../components/game/Board';
import { LIBRARY } from '../../data/puzzles';
import { gridFromSolution, parseClue } from '../../engine/clues';
import { toLpFormat, ilpStats } from '../../engine/ilp';
import { generatePatterns, solveLine } from '../../engine/patterns';
import { EMPTY, FILLED, UNKNOWN } from '../../types/puzzle';

function TeX({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(children, { displayMode: block, throwOnError: false, output: 'htmlAndMathml' }), [children, block]);
  return block ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const sections = [
  ['rules', 'Luật chơi'],
  ['clues', 'Đọc chỉ dẫn'],
  ['by-hand', 'Giải bằng tay'],
  ['line-lab', 'Thử nghiệm hàng/cột'],
  ['csp', 'Bài toán thỏa mãn ràng buộc'],
  ['solver', 'Cách bộ giải hoạt động'],
  ['ilp', 'Quy hoạch tuyến tính nguyên'],
  ['compare', 'ILP và bộ giải này'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`learn-${id}`} aria-labelledby={`h-${id}`} className="scroll-mt-6 border-t border-rule pt-6 pb-4">
      <h2 id={`h-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

function LineStrip({ cells, size = 16, label }: { cells: ArrayLike<number>; size?: number; label?: string }) {
  return (
    <div className="flex" role="img" aria-label={label}>
      {Array.from(cells).map((v, i) => (
        <span
          key={i}
          className="relative block border border-rule"
          style={{
            width: size,
            height: size,
            marginLeft: i ? -1 : 0,
            background: v === FILLED ? 'var(--fill)' : v === EMPTY ? 'var(--sheet)' : 'var(--highlight-soft)',
          }}
        >
          {v === EMPTY && <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none text-pencil">×</span>}
        </span>
      ))}
    </div>
  );
}

function LineLab() {
  const [clueText, setClueText] = useState('3 1');
  const [length, setLength] = useState(8);
  const [known, setKnown] = useState('........'.replace(/\./g, '?'));
  const clue = parseClue(clueText);
  const line = useMemo(() => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = known[i] === '#' ? FILLED : known[i] === 'x' ? EMPTY : UNKNOWN;
    return out;
  }, [known, length]);
  const patterns = clue ? generatePatterns(clue, length, { consistentWith: line, limit: 60 }) : [];
  const result = clue ? solveLine(clue, line) : null;

  const cycle = (i: number) => {
    const chars = known.padEnd(length, '?').split('').slice(0, length);
    chars[i] = chars[i] === '?' ? '#' : chars[i] === '#' ? 'x' : '?';
    setKnown(chars.join(''));
  };

  return (
    <div className="my-4 border border-rule bg-sheet p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block text-pencil">Chỉ dẫn</span>
          <input className="field mt-1 w-28 font-mono" value={clueText} onChange={(e) => setClueText(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-pencil">Độ dài hàng/cột</span>
          <input
            className="field mt-1 w-20"
            type="number"
            min={1}
            max={20}
            value={length}
            onChange={(e) => {
              const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
              setLength(n);
              setKnown((k) => k.padEnd(n, '?').slice(0, n));
            }}
          />
        </label>
        <div className="text-sm">
          <span className="block text-pencil">Thông tin đã biết (nhấn ô: chưa biết, đã tô, trống)</span>
          <div className="mt-1 flex">
            {Array.from({ length }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => cycle(i)}
                aria-label={`Ô ${i + 1}: ${line[i] === FILLED ? 'đã tô' : line[i] === EMPTY ? 'trống' : 'chưa biết'}`}
                className="relative block size-6 border border-rule-strong"
                style={{ marginLeft: i ? -1 : 0, background: line[i] === FILLED ? 'var(--fill)' : 'var(--sheet)' }}
              >
                {line[i] === EMPTY && <span className="text-xs text-pencil">×</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!clue ? (
        <p className="mt-4 text-sm text-redpen">Chỉ dẫn phải gồm các số cách nhau bằng dấu cách.</p>
      ) : !result?.ok ? (
        <p className="mt-4 text-sm text-redpen">Không có cách sắp xếp nào của {clueText} phù hợp. Trong câu đố, đây là mâu thuẫn: một bước trước đó đã sai.</p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-pencil">
              {result.placements} cách sắp xếp phù hợp
              {patterns.length < result.placements ? `, hiện ${patterns.length} cách đầu` : ''}:
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-2">
              {patterns.map((p, i) => (
                <LineStrip key={i} cells={p} size={14} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-pencil">Các ô có cùng trạng thái trong mọi cách sắp xếp:</p>
            <LineStrip cells={result.line} size={22} label="Hàng/cột đã suy luận" />
            <p className="mt-2 text-sm">
              {result.changed.length === 0
                ? 'Không thể suy ra thông tin mới chỉ từ hàng/cột này.'
                : `Đã xác định thêm ${result.changed.length} ô. Các ô tô bóng vẫn chưa xác định.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function LearnView() {
  const example = LIBRARY.find((p) => p.id.startsWith('b01'))!;
  const exampleGrid = useMemo(() => gridFromSolution(example.solution).grid, [example]);
  const [lpId, setLpId] = useState(LIBRARY[0]!.id);
  const lpPuzzle = LIBRARY.find((p) => p.id === lpId)!;
  const stats = ilpStats(lpPuzzle);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-6 sm:px-6 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12 lg:pt-8">
      <nav aria-label="Nội dung trang" className="hidden lg:block">
        <div className="sticky top-6">
          <p className="mb-2 text-sm font-semibold">Hướng dẫn</p>
          <ul className="space-y-1 text-sm">
            {sections.map(([id, label]) => (
              <li key={id}>
                <button
                  type="button"
                  className="text-left text-pencil hover:text-ink"
                  onClick={() => document.getElementById(`learn-${id}`)?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <article className="prose-learn min-w-0">
        <h1 className="mb-1 text-xl font-semibold">Cách chơi nonogram</h1>
        <p className="text-pencil">
          Từ luật chơi đến toán học: cách đọc chỉ dẫn, suy luận theo hàng/cột và hai cách máy tính giải toàn bộ bảng.
        </p>

        <Section id="rules" title="Luật chơi">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p>
                Nonogram là một bảng ô vuông với dãy số bên cạnh mỗi hàng và phía trên mỗi cột. Mỗi ô được tô hoặc để trống. Hãy tô sao cho từng hàng và cột khớp với dãy số tương ứng. Các ô được tô sẽ tạo thành một bức hình.
              </p>
              <p>
                Trong bảng này, hàng trên cùng có chỉ dẫn <code>1 1</code>: hai ô tô riêng lẻ theo thứ tự, có ít nhất một ô trống ở giữa. Hàng thứ hai có chỉ dẫn <code>5</code>: năm ô tô liên tiếp, tức toàn bộ hàng.
              </p>
            </div>
            <div className="w-48">
              <Board clues={example} board={exampleGrid} mode="view" solved maxCell={20} heightBudget={0.4} crosshair={false} label="Ví dụ bảng 5 × 5 đã giải" />
            </div>
          </div>
        </Section>

        <Section id="clues" title="Đọc chỉ dẫn">
          <ul>
            <li>Mỗi số là độ dài của một đoạn ô tô liên tiếp.</li>
            <li>Các đoạn xuất hiện theo thứ tự liệt kê: từ trái sang phải với hàng, từ trên xuống dưới với cột.</li>
            <li>Giữa hai đoạn có ít nhất một ô trống. Trước đoạn đầu và sau đoạn cuối có thể có bao nhiêu ô trống tùy ý.</li>
            <li>
              Chỉ dẫn <code>0</code> nghĩa là cả hàng/cột đều trống.
            </li>
          </ul>
          <p>
            Số ô tối thiểu cần có bằng tổng độ dài các đoạn cộng số khoảng cách giữa chúng. <code>3 1 2</code> cần 3 + 1 + 2 + 2 = 8 ô. Với hàng/cột dài 10 ô, còn dư 2 ô. Chính phần dư này quyết định mức độ khó của hàng/cột.
          </p>
        </Section>

        <Section id="by-hand" title="Giải bằng tay">
          <h3>Phần chồng lấp</h3>
          <p>
            Đẩy mỗi đoạn hết sang trái rồi hết sang phải. Ô nào thuộc cùng một đoạn ở cả hai vị trí chắc chắn phải tô. Đoạn dài 8 trong hàng/cột dài 10 có 2 ô dư, nên có thể tô ngay 6 ô ở giữa.
          </p>
          <h3>Mép bảng và vách ngăn</h3>
          <p>
            Ô đã tô nằm sát mép bảng hoặc cạnh ô được đánh dấu trống giúp xác định vị trí đoạn. Nếu đoạn đầu dài 3 và ô đầu đã tô, thì ba ô đầu phải tô và ô thứ tư phải trống.
          </p>
          <h3>Vai trò của dấu trống</h3>
          <p>
            Đánh dấu những ô chắc chắn trống giúp chia hàng/cột thành các phần ngắn hơn. Nếu một đoạn không vừa một phần, có thể loại phần đó. Ở câu đố khó, các dấu trống thường giúp tìm ra bước tiến mới.
          </p>
          <h3>Đối chiếu hàng và cột</h3>
          <p>
            Mỗi ô thuộc một hàng và một cột. Trạng thái xác định từ hàng cung cấp thông tin mới cho cột tương ứng. Quá trình giải luân phiên hai hướng cho đến khi không còn thay đổi.
          </p>
        </Section>

        <Section id="line-lab" title="Thử nghiệm hàng/cột">
          <p>
            Các suy luận trên đều tuân theo một quy tắc: liệt kê mọi cách sắp xếp phù hợp với thông tin đã biết, rồi giữ các ô có trạng thái giống nhau trong tất cả các cách. Hãy thử bên dưới.
          </p>
          <LineLab />
        </Section>

        <Section id="csp" title="Bài toán thỏa mãn ràng buộc">
          <p>
            Nonogram là một bài toán thỏa mãn ràng buộc. Các biến là các ô, mỗi ô có miền giá trị {'{'}tô, trống{'}'}. Mỗi hàng và cột đóng góp một ràng buộc: trạng thái các ô phải khớp với chỉ dẫn.
          </p>
          <p>
            Giải chính xác một hàng/cột như phần thử nghiệm tốn ít tính toán. Hàng/cột dài <TeX>n</TeX> với <TeX>k</TeX> đoạn có thể được giải trong khoảng <TeX>{'O(n \\cdot k)'}</TeX> bước bằng quy hoạch động mà không cần liệt kê từng cách sắp xếp. Phần khó là làm cho mọi hàng và cột cùng nhất quán. Xác định một nonogram tổng quát có nghiệm hay không là bài toán NP-đầy đủ, nên chưa có phương pháp nhanh cho mọi câu đố. Những câu đố thú vị thường có thể giải chỉ bằng suy luận theo hàng/cột.
          </p>
        </Section>

        <Section id="solver" title="Cách bộ giải hoạt động">
          <p>Bộ giải kết hợp suy luận theo hàng/cột với tìm kiếm. Tác vụ chạy trong luồng nền để trang vẫn phản hồi thao tác.</p>
          <ul>
            <li>
              <strong>Lan truyền.</strong> Hàng đợi chứa các hàng/cột có thể suy ra thông tin mới. Mỗi hàng/cột được giải chính xác bằng quy hoạch động. Ô mới xác định đưa hàng/cột giao nhau trở lại hàng đợi. Lặp lại đến khi hàng đợi rỗng.
            </li>
            <li>
              <strong>Mâu thuẫn.</strong> Nếu một hàng/cột không còn cách sắp xếp hợp lệ, trạng thái hiện tại là bất khả thi.
            </li>
            <li>
              <strong>Phân nhánh.</strong> Nếu lan truyền dừng khi vẫn còn ô chưa biết, bộ giải chọn hàng/cột có ít cách sắp xếp nhất, chọn một ô chưa biết trong đó rồi thử tô trước, để trống sau.
            </li>
            <li>
              <strong>Quay lui.</strong> Mỗi phỏng đoán chạy trên một bản sao của bảng. Nếu gặp mâu thuẫn, bỏ bản sao và thử giá trị còn lại.
            </li>
            <li>
              <strong>Nghiệm duy nhất.</strong> Sau nghiệm đầu tiên, quá trình tìm kiếm tiếp tục. Tìm được nghiệm thứ hai chứng tỏ câu đố có nhiều nghiệm. Tìm hết mọi khả năng mà chỉ có một nghiệm sẽ chứng minh tính duy nhất. Nếu đạt giới hạn bước trước, bộ giải báo chưa thể kết luận.
            </li>
          </ul>
          <p>
            Bạn có thể xem từng sự kiện trong <a href="#/solver">Bộ giải</a>. Mỗi câu đố tuyển chọn trong thư viện đều được kiểm tra theo cách này và có đúng một nghiệm.
          </p>
        </Section>

        <Section id="ilp" title="Quy hoạch tuyến tính nguyên">
          <p>
            Cùng một câu đố có thể được biểu diễn bằng quy hoạch tuyến tính nguyên: hệ phương trình và bất phương trình tuyến tính với các biến chỉ nhận 0 hoặc 1. Dưới đây là một mô hình thông dụng cho bảng có <TeX>W</TeX> cột và <TeX>H</TeX> hàng.
          </p>
          <h3>Các biến</h3>
          <p>
            Hàng <TeX>r</TeX> có chỉ dẫn <TeX>{'(L_{r,1}, \\dots, L_{r,k_r})'}</TeX>. Cột <TeX>c</TeX> có chỉ dẫn{' '}
            <TeX>{'(M_{c,1}, \\dots, M_{c,m_c})'}</TeX>.
          </p>
          <TeX block>{String.raw`\begin{aligned}
x_{r,c} &\in \{0,1\} && \text{ô } (r,c) \text{ được tô}\\
s_{r,b,j} &\in \{0,1\} && \text{đoạn } b \text{ của hàng } r \text{ bắt đầu tại cột } j\\
t_{c,b,i} &\in \{0,1\} && \text{đoạn } b \text{ của cột } c \text{ bắt đầu tại hàng } i
\end{aligned}`}</TeX>
          <p>
            Một đoạn chỉ có thể bắt đầu ở nơi vẫn đủ chỗ cho các đoạn trước và sau, nên <TeX>j</TeX> nằm trong khoảng
          </p>
          <TeX block>{String.raw`J_{r,b} = \Big[\, 1 + \sum_{a<b} (L_{r,a}+1),\;\; W + 1 - \sum_{a \ge b} L_{r,a} - (k_r - b) \,\Big]`}</TeX>
          <h3>Mỗi đoạn bắt đầu đúng một lần</h3>
          <TeX block>{String.raw`\sum_{j \in J_{r,b}} s_{r,b,j} = 1 \qquad \forall r,\; b = 1,\dots,k_r`}</TeX>
          <h3>Các đoạn giữ đúng thứ tự và có khoảng cách</h3>
          <p>Vì có đúng một biến vị trí bắt đầu bằng 1, tổng có trọng số chính là cột bắt đầu:</p>
          <TeX block>{String.raw`\sum_{j} j\, s_{r,b+1,j} \;\ge\; \sum_{j} j\, s_{r,b,j} + L_{r,b} + 1 \qquad \forall r,\; b = 1,\dots,k_r - 1`}</TeX>
          <h3>Các đoạn tô đúng các ô của mình</h3>
          <p>Một ô được tô khi và chỉ khi có một đoạn bắt đầu đủ gần về bên trái để bao phủ ô đó:</p>
          <TeX block>{String.raw`x_{r,c} = \sum_{b=1}^{k_r} \;\; \sum_{\substack{j \in J_{r,b} \\ j \,\le\, c \,\le\, j + L_{r,b} - 1}} s_{r,b,j} \qquad \forall r, c`}</TeX>
          <p>
            Nhờ ràng buộc khoảng cách, các đoạn không chồng lên nhau, nên vế phải không vượt quá 1; một hàng trống (<TeX>k_r = 0</TeX>) buộc <TeX>{'x_{r,c} = 0'}</TeX>.
          </p>
          <h3>Hàng và cột nhất quán</h3>
          <p>
            Ràng buộc cho cột cũng gồm ba nhóm tương tự với <TeX>{'t_{c,b,i}'}</TeX> và <TeX>{'M_{c,b}'}</TeX>, liên kết với cùng các biến ô:
          </p>
          <TeX block>{String.raw`x_{r,c} = \sum_{b=1}^{m_c} \;\; \sum_{\substack{i \in I_{c,b} \\ i \,\le\, r \,\le\, i + M_{c,b} - 1}} t_{c,b,i} \qquad \forall r, c`}</TeX>
          <p>
            Dùng chung <TeX>{'x_{r,c}'}</TeX> giữa hai nhóm giúp hàng và cột nhất quán. Không có đại lượng cần tối ưu nên hàm mục tiêu là hằng số: mọi điểm khả thi đều là một nghiệm.
          </p>
          <h3>Kiểm tra tính duy nhất bằng ràng buộc loại nghiệm</h3>
          <p>
            Với một nghiệm <TeX>{'x^*'}</TeX>, thêm ràng buộc dưới đây rồi giải lại. Nếu mô hình trở nên bất khả thi, nghiệm ban đầu là duy nhất.
          </p>
          <TeX block>{String.raw`\sum_{(r,c):\, x^*_{r,c}=1} (1 - x_{r,c}) \;+ \sum_{(r,c):\, x^*_{r,c}=0} x_{r,c} \;\ge\; 1`}</TeX>
        </Section>

        <Section id="compare" title="ILP và bộ giải này">
          <p>
            Bộ giải trong trình duyệt của Nonogram Studio sử dụng lan truyền và quay lui. Cách này nhanh hơn với câu đố cỡ nhỏ và cho phép hiển thị từng bước. Mô hình ILP ở trên được xuất để giải bằng công cụ bên ngoài. Hai cách tiếp cận được so sánh dưới đây:
          </p>
          <div className="my-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule-strong text-left">
                  <th className="py-2 pr-4 font-medium"></th>
                  <th className="py-2 pr-4 font-medium">Lan truyền và quay lui (dùng trong ứng dụng)</th>
                  <th className="py-2 font-medium">Quy hoạch tuyến tính nguyên</th>
                </tr>
              </thead>
              <tbody className="align-top [&_td]:py-2 [&_td]:pr-4 [&_tr]:border-b [&_tr]:border-rule">
                <tr>
                  <td className="text-pencil">Suy luận</td>
                  <td>Suy luận chính xác từng hàng/cột, lặp đến khi ổn định</td>
                  <td>Nới lỏng LP, sau đó nhánh cận kết hợp mặt phẳng cắt</td>
                </tr>
                <tr>
                  <td className="text-pencil">Phỏng đoán</td>
                  <td>Phân nhánh tại một ô trong hàng/cột bị ràng buộc nhiều nhất</td>
                  <td>Phân nhánh theo các biến có giá trị phân số</td>
                </tr>
                <tr>
                  <td className="text-pencil">Tính duy nhất</td>
                  <td>Tiếp tục tìm nghiệm thứ hai</td>
                  <td>Thêm ràng buộc loại nghiệm đã tìm rồi giải lại</td>
                </tr>
                <tr>
                  <td className="text-pencil">Ưu điểm</td>
                  <td>Tương tự cách con người giải; có thể giải thích từng bước</td>
                  <td>Đa dụng; dễ thêm ràng buộc màu sắc hoặc đối xứng</td>
                </tr>
                <tr>
                  <td className="text-pencil">Môi trường chạy</td>
                  <td>Trong trình duyệt, qua tác vụ nền</td>
                  <td>Trong bộ giải bên ngoài như HiGHS, GLPK, CBC hoặc Gurobi</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3>Xuất mô hình</h3>
          <p>
            Tải mô hình trên cho bất kỳ câu đố nào trong thư viện dưới dạng tệp <code>.lp</code> (định dạng CPLEX LP) và giải bằng bộ giải ILP tùy chọn. Trong quá trình phát triển, các mô hình xuất ra đã được giải bằng HiGHS và cho kết quả khớp đáp án đã lưu.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-pencil">Câu đố</span>
              <select className="field mt-1" value={lpId} onChange={(e) => setLpId(e.target.value)}>
                {LIBRARY.map((p) => (
                  <option key={p.id} value={p.id}>
                    Câu số {p.number} ({p.width} × {p.height})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-line" onClick={() => download(`nonogram-${lpPuzzle.number}.lp`, toLpFormat(lpPuzzle, `Câu trong thư viện số ${lpPuzzle.number}`))}>
              <Download size={16} aria-hidden="true" /> Tải .lp
            </button>
          </div>
          <p className="mt-2 text-sm text-pencil">
            Mô hình này: {stats.cellVars} biến ô, {stats.startVars} biến vị trí bắt đầu đoạn, {stats.constraints} ràng buộc.
          </p>
        </Section>
      </article>
    </div>
  );
}
