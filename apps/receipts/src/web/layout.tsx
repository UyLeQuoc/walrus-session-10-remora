import type { Child } from "hono/jsx";

const css = `
:root{--bg:#0f1115;--card:#171a21;--line:#2a2f3a;--text:#e8eaf0;--muted:#9aa3b2;--accent:#f5c451;--good:#5fd38d;--bad:#ff6b6b;--chip:#232837}
@media (prefers-color-scheme: light){:root{--bg:#f6f7f9;--card:#fff;--line:#e3e6ec;--text:#14161b;--muted:#5b6474;--accent:#b7791f;--good:#1f9d55;--bad:#d64545;--chip:#f1f3f7}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}a{color:var(--accent)}h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:20px 0 8px}
nav{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 16px;font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.muted{color:var(--muted);font-size:13px}
.voices{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin:8px 0}
.voice{background:var(--chip);border-radius:8px;padding:6px 8px;font-size:13px}.voice b{display:block;font-size:16px}
.call{border-left:3px solid var(--accent);padding-left:10px;margin:8px 0}
.chip{display:block;background:var(--chip);border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px}
.tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:999px;background:var(--chip);color:var(--muted);margin-left:6px}
.ok{color:var(--good)}.no{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 4px;border-bottom:1px solid var(--line);text-align:left}
form.inline{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
input,select,button{font:inherit;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text)}
button{background:var(--accent);color:#111;border:0;font-weight:600;cursor:pointer}
code{font-size:12px;word-break:break-all}svg{max-width:100%;height:auto}
`;

export function Layout(props: { title: string; groupId?: string; children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <style>{css}</style>
      </head>
      <body>
        <main>
          <div class="row" style="justify-content:space-between">
            <a href="/" style="text-decoration:none;color:inherit">
              <strong>🧾 Receipts</strong>
            </a>
            <span class="muted">picks sealed on Sui · testnet</span>
          </div>
          {props.groupId ? (
            <nav>
              <a href={`/g/${props.groupId}`}>Board</a>
              <a href={`/g/${props.groupId}/scores`}>Scores</a>
              <a href={`/g/${props.groupId}/learning`}>Learning</a>
              <a href={`/g/${props.groupId}/memory`}>What it learned</a>
            </nav>
          ) : null}
          {props.children}
        </main>
      </body>
    </html>
  );
}
