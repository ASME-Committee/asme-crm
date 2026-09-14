/** Newsletter content model: a small set of blocks that render to a branded,
 *  email-safe HTML document. Kept deliberately simple — enough to write a good
 *  society update without a full page builder. */

export type Block =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "button"; text: string; url: string }
  | { type: "image"; url: string; alt?: string };

export type BlockType = Block["type"];

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Heading",
  text: "Paragraph",
  button: "Button",
  image: "Image",
};

export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "heading":
      return { type, text: "Section heading" };
    case "text":
      return { type, text: "Write your update here." };
    case "button":
      return { type, text: "Read more", url: "https://asme.org.au" };
    case "image":
      return { type, url: "", alt: "" };
  }
}

const BRAND = "#1F63EF";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Preserve author line breaks in paragraphs.
const para = (s: string) => esc(s).replace(/\n/g, "<br/>");

function renderBlock(b: Block): string {
  switch (b.type) {
    case "heading":
      return `<h2 style="margin:28px 0 8px;font-size:20px;line-height:1.3;color:#0b1020;font-weight:700;">${esc(b.text)}</h2>`;
    case "text":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${para(b.text)}</p>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:8px;background:${BRAND};">
        <a href="${esc(b.url)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(b.text)}</a>
      </td></tr></table>`;
    case "image":
      return b.url
        ? `<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" style="max-width:100%;border-radius:10px;margin:8px 0 20px;display:block;"/>`
        : "";
  }
}

/** Full email document. */
export function renderEmail(subject: string, blocks: Block[]): string {
  const body = blocks.map(renderBlock).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:22px 32px;border-bottom:1px solid #eef2f7;">
          <span style="font-size:16px;font-weight:700;color:${BRAND};">ASME</span>
          <span style="font-size:13px;color:#94a3b8;"> · Australian Society for Medical Entrepreneurship &amp; Innovation</span>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 4px;font-size:24px;line-height:1.25;color:#0b1020;font-weight:800;">${esc(subject)}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">${body}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #eef2f7;font-size:12px;color:#94a3b8;">
          You're receiving this as a member of ASME. <a href="{{ unsubscribe_url }}" style="color:#94a3b8;">Unsubscribe</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
