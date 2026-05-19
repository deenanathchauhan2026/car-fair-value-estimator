export function visibleText(root: ParentNode = document) {
  const clone = root instanceof Document ? root.body?.cloneNode(true) as HTMLElement | undefined : (root as HTMLElement).cloneNode(true) as HTMLElement;
  clone?.querySelectorAll('script,style,noscript').forEach(n=>n.remove());
  return clone?.innerText || clone?.textContent || '';
}
export const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[property="${name}"],meta[name="${name}"]`)?.content;
export const textOf = (selector: string) => document.querySelector<HTMLElement>(selector)?.innerText?.trim();
