declare module 'dom-to-image' {
    function toPng(node: Node, options?: object): Promise<string>;
  }