export function Description({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
