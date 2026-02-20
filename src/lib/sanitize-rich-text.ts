const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "code",
  "pre",
  "a",
]);

const sanitizeHref = (value: string): string | null => {
  const next = value.trim();
  if (!next) return null;
  if (/^https?:\/\//i.test(next) || /^mailto:/i.test(next) || /^tel:/i.test(next)) return next;
  return null;
};

export const sanitizeRichTextHtml = (html: string): string => {
  if (!html || html.trim().length === 0) return "";

  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/ on\w+="[^"]*"/gi, "")
      .replace(/ on\w+='[^']*'/gi, "");
  }

  const parser = new window.DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  const sanitizeNode = (node: Element) => {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }
      parent.removeChild(node);
      return;
    }

    const attrs = Array.from(node.attributes);
    attrs.forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
        return;
      }
      if (tag === "a" && name === "href") {
        const safeHref = sanitizeHref(attribute.value);
        if (!safeHref) {
          node.removeAttribute("href");
        } else {
          node.setAttribute("href", safeHref);
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
        return;
      }
      if (tag === "a" && (name === "target" || name === "rel")) return;
      node.removeAttribute(attribute.name);
    });
  };

  const nodes = Array.from(documentNode.body.querySelectorAll("*"));
  nodes.forEach((node) => sanitizeNode(node));
  return documentNode.body.innerHTML;
};

