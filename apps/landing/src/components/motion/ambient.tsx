/**
 * Fixed full-page ambient background: cool light grey base, a white glow top left, a cool grey-blue glow right and a
 * faint warm peach glow low in the hero (all derived from the brand greys and orange). The blobs are radial gradients
 * that drift very slowly (transform only), plus a very light static grain. Sits behind the page (`-z-10`), so `body`
 * must stay transparent and `html` carries the base colour.
 */
export function Ambient() {
  return (
    <div aria-hidden="true" className="amb pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#ECECF0]">
      <i className="amb-blob amb-white" />
      <i className="amb-blob amb-cool" />
      <i className="amb-blob amb-white2" />
      <i className="amb-blob amb-peach" />
      <i className="amb-blob amb-peach2" />
      <i className="amb-grain absolute inset-0" />
    </div>
  );
}
